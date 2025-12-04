import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userRole?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { payout_request_id, action } = body;

    console.log(`Processing payout action: ${action} for request: ${payout_request_id}`);

    if (action === "approve") {
      // Get payout request details
      const { data: payoutRequest, error: prError } = await supabaseAdmin
        .from("payout_requests")
        .select(`
          *,
          placement:placements (
            id,
            recruiter_payout,
            submission:submissions (
              recruiter_id
            )
          )
        `)
        .eq("id", payout_request_id)
        .single();

      if (prError || !payoutRequest) {
        console.error("Payout request not found:", prError);
        return new Response(JSON.stringify({ error: "Payout request not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get recruiter's Stripe account
      const { data: stripeAccount } = await supabaseAdmin
        .from("stripe_accounts")
        .select("stripe_account_id, payouts_enabled")
        .eq("user_id", payoutRequest.recruiter_id)
        .maybeSingle();

      if (!stripeAccount || !stripeAccount.payouts_enabled) {
        return new Response(JSON.stringify({ 
          error: "Recruiter has not completed Stripe onboarding" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update status to processing
      await supabaseAdmin
        .from("payout_requests")
        .update({
          status: "processing",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", payout_request_id);

      // Create Stripe transfer
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(payoutRequest.amount * 100), // Convert to cents
          currency: payoutRequest.currency.toLowerCase(),
          destination: stripeAccount.stripe_account_id,
          metadata: {
            payout_request_id: payout_request_id,
            placement_id: payoutRequest.placement_id,
          },
        });

        console.log(`Created transfer: ${transfer.id}`);

        // Update payout request with transfer ID
        await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "completed",
            stripe_transfer_id: transfer.id,
            processed_at: new Date().toISOString(),
          })
          .eq("id", payout_request_id);

        // Update placement status
        await supabaseAdmin
          .from("placements")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            escrow_status: "released",
          })
          .eq("id", payoutRequest.placement_id);

        // Create notification for recruiter
        await supabaseAdmin.from("notifications").insert({
          user_id: payoutRequest.recruiter_id,
          type: "payout_completed",
          title: "Auszahlung abgeschlossen",
          message: `Deine Auszahlung von ${payoutRequest.amount} ${payoutRequest.currency} wurde erfolgreich verarbeitet.`,
          related_type: "payout_request",
          related_id: payout_request_id,
        });

        return new Response(JSON.stringify({ 
          success: true, 
          transfer_id: transfer.id 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (stripeError: unknown) {
        console.error("Stripe transfer error:", stripeError);
        const errorMessage = stripeError instanceof Error ? stripeError.message : "Transfer failed";

        await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "failed",
            failure_reason: errorMessage,
          })
          .eq("id", payout_request_id);

        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "reject") {
      const { reason } = body;

      await supabaseAdmin
        .from("payout_requests")
        .update({
          status: "cancelled",
          failure_reason: reason || "Rejected by admin",
        })
        .eq("id", payout_request_id);

      // Get recruiter ID for notification
      const { data: payoutRequest } = await supabaseAdmin
        .from("payout_requests")
        .select("recruiter_id")
        .eq("id", payout_request_id)
        .single();

      if (payoutRequest) {
        await supabaseAdmin.from("notifications").insert({
          user_id: payoutRequest.recruiter_id,
          type: "payout_rejected",
          title: "Auszahlung abgelehnt",
          message: reason || "Deine Auszahlungsanfrage wurde abgelehnt.",
          related_type: "payout_request",
          related_id: payout_request_id,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Process payout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
