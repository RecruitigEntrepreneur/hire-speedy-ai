import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  console.log("Received webhook event");

  let event: Stripe.Event;

  try {
    // Verify webhook signature if secret is set
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
    } else {
      // For development/testing without webhook secret
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
    });
  }

  console.log(`Processing event: ${event.type}`);

  // Log event to database
  await supabaseAdmin.from("payment_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
    processed: false,
  });

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment succeeded: ${paymentIntent.id}`);

        // Update invoice status
        const { data: invoice } = await supabaseAdmin
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .select("placement_id")
          .maybeSingle();

        if (invoice?.placement_id) {
          // Update placement escrow status
          const escrowReleaseDate = new Date();
          escrowReleaseDate.setDate(escrowReleaseDate.getDate() + 90);

          await supabaseAdmin
            .from("placements")
            .update({
              escrow_status: "held",
              escrow_release_date: escrowReleaseDate.toISOString(),
              payment_status: "confirmed",
            })
            .eq("id", invoice.placement_id);

          console.log(`Updated placement ${invoice.placement_id} to escrow held`);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        console.log(`Account updated: ${account.id}`);

        await supabaseAdmin
          .from("stripe_accounts")
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            onboarding_complete: account.charges_enabled && account.payouts_enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", account.id);
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        console.log(`Transfer created: ${transfer.id}`);

        await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "completed",
            stripe_transfer_id: transfer.id,
            processed_at: new Date().toISOString(),
          })
          .eq("stripe_transfer_id", transfer.id);
        break;
      }

      case "transfer.failed": {
        const transfer = event.data.object as Stripe.Transfer;
        console.log(`Transfer failed: ${transfer.id}`);

        await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "failed",
            failure_reason: "Transfer failed",
            processed_at: new Date().toISOString(),
          })
          .eq("stripe_transfer_id", transfer.id);
        break;
      }
    }

    // Mark event as processed
    await supabaseAdmin
      .from("payment_events")
      .update({ processed: true })
      .eq("stripe_event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabaseAdmin
      .from("payment_events")
      .update({ error_message: errorMessage })
      .eq("stripe_event_id", event.id);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
