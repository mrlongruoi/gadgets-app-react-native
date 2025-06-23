// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@^18.2.1";
import { getOrCreateStripeCustomerForSupabaseUser } from "../supabase.ts";

const stripe = Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  // This is needed to use the Fetch API rather than relying on the Node http
  // package.
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log("Request body:", body);
    
    const { totalAmount } = body;
    console.log("totalAmount:", totalAmount, typeof totalAmount);

    // Dùng hàm thật để lấy/tạo customer từ Supabase user
    const customer = await getOrCreateStripeCustomerForSupabaseUser(req);
    console.log("customer:", customer);

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer },
      { apiVersion: "2025-05-28.basil" }
    );
    console.log("ephemeralKey created successfully");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "usd",
      customer,
    });
    console.log("paymentIntent created successfully");

    const response = {
      paymentIntent: paymentIntent.client_secret,
      publicKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY"),
      ephemeralKey: ephemeralKey.secret,
      customer,
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Function error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl.exe -i --location --request POST 'http://127.0.0.1:54321/functions/v1/stripe-checkout' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"totalAmount":4000}'

*/
