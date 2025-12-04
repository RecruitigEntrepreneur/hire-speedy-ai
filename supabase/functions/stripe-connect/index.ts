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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log(`Stripe Connect action: ${action} for user: ${user.id}`);

    // Get user profile for email
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (action === "create-account") {
      // Check if account already exists
      const { data: existingAccount } = await supabaseClient
        .from("stripe_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingAccount) {
        return new Response(JSON.stringify({ 
          success: true, 
          account: existingAccount,
          message: "Account already exists" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: "express",
        country: "DE",
        email: profile?.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          user_id: user.id,
        },
      });

      console.log(`Created Stripe account: ${account.id}`);

      // Save to database
      const { data: savedAccount, error: saveError } = await supabaseClient
        .from("stripe_accounts")
        .insert({
          user_id: user.id,
          stripe_account_id: account.id,
          account_type: "express",
        })
        .select()
        .single();

      if (saveError) {
        console.error("Error saving account:", saveError);
        throw saveError;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        account: savedAccount 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-account-link") {
      const { data: stripeAccount } = await supabaseClient
        .from("stripe_accounts")
        .select("stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!stripeAccount) {
        return new Response(JSON.stringify({ error: "No Stripe account found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const returnUrl = body.return_url || `${req.headers.get("origin")}/recruiter/payouts`;
      const refreshUrl = body.refresh_url || `${req.headers.get("origin")}/recruiter/payouts`;

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccount.stripe_account_id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      console.log(`Created account link for: ${stripeAccount.stripe_account_id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        url: accountLink.url 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "account-status") {
      const { data: stripeAccount } = await supabaseClient
        .from("stripe_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!stripeAccount) {
        return new Response(JSON.stringify({ 
          success: true, 
          account: null,
          hasAccount: false 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get latest status from Stripe
      const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);

      // Update local record
      const { data: updatedAccount } = await supabaseClient
        .from("stripe_accounts")
        .update({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          onboarding_complete: account.charges_enabled && account.payouts_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      return new Response(JSON.stringify({ 
        success: true, 
        account: updatedAccount,
        hasAccount: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Stripe Connect error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
