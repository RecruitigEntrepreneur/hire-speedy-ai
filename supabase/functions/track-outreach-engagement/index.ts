import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 Transparent GIF
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const emailId = url.searchParams.get("eid");
  const redirect = url.searchParams.get("redirect");

  console.log(`Tracking engagement: type=${type}, emailId=${emailId}`);

  if (!emailId) {
    console.error("Missing email ID");
    return new Response("Missing email ID", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (type === "open") {
      console.log(`Tracking email open for ${emailId}`);

      // Hole aktuelle Daten
      const { data: email } = await supabase
        .from("outreach_emails")
        .select("open_count, opened_at, campaign_id")
        .eq("id", emailId)
        .single();

      // Öffnung tracken
      const { error: updateError } = await supabase
        .from("outreach_emails")
        .update({
          opened_at: email?.opened_at || new Date().toISOString(),
          open_count: (email?.open_count || 0) + 1
        })
        .eq("id", emailId);

      if (updateError) {
        console.error("Error updating open tracking:", updateError);
      } else {
        console.log(`Email ${emailId} open tracked, count: ${(email?.open_count || 0) + 1}`);
        
        // Kampagnen-Stats aktualisieren (nur beim ersten Öffnen)
        if (!email?.opened_at && email?.campaign_id) {
          const { data: campaign } = await supabase
            .from("outreach_campaigns")
            .select("stats")
            .eq("id", email.campaign_id)
            .single();
            
          if (campaign) {
            const currentStats = campaign.stats || { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 };
            await supabase
              .from("outreach_campaigns")
              .update({
                stats: { ...currentStats, opened: (currentStats.opened || 0) + 1 }
              })
              .eq("id", email.campaign_id);
          }
        }
      }

      // Tracking Pixel zurückgeben
      return new Response(TRACKING_PIXEL, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });

    } else if (type === "click" && redirect) {
      console.log(`Tracking click for ${emailId}, redirect to ${redirect}`);

      // Hole aktuelle Daten
      const { data: email } = await supabase
        .from("outreach_emails")
        .select("click_count, clicked_at, clicked_links, campaign_id")
        .eq("id", emailId)
        .single();

      const clickedLinks = email?.clicked_links || [];
      clickedLinks.push({
        url: redirect,
        clicked_at: new Date().toISOString()
      });

      // Klick tracken
      const { error: updateError } = await supabase
        .from("outreach_emails")
        .update({
          clicked_at: email?.clicked_at || new Date().toISOString(),
          click_count: (email?.click_count || 0) + 1,
          clicked_links: clickedLinks
        })
        .eq("id", emailId);

      if (updateError) {
        console.error("Error updating click tracking:", updateError);
      } else {
        console.log(`Email ${emailId} click tracked, count: ${(email?.click_count || 0) + 1}`);
        
        // Kampagnen-Stats aktualisieren (nur beim ersten Klick)
        if (!email?.clicked_at && email?.campaign_id) {
          const { data: campaign } = await supabase
            .from("outreach_campaigns")
            .select("stats")
            .eq("id", email.campaign_id)
            .single();
            
          if (campaign) {
            const currentStats = campaign.stats || { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 };
            await supabase
              .from("outreach_campaigns")
              .update({
                stats: { ...currentStats, clicked: (currentStats.clicked || 0) + 1 }
              })
              .eq("id", email.campaign_id);
          }
        }
      }

      // Redirect zum Ziel-URL
      return Response.redirect(redirect, 302);
    }

    console.error("Invalid tracking request");
    return new Response("Invalid request", { status: 400 });

  } catch (error: any) {
    console.error("Tracking error:", error);
    
    // Bei Fehlern trotzdem Pixel/Redirect zurückgeben
    if (type === "open") {
      return new Response(TRACKING_PIXEL, { 
        headers: { "Content-Type": "image/gif" } 
      });
    }
    if (redirect) {
      return Response.redirect(redirect, 302);
    }
    return new Response("Error", { status: 500 });
  }
});
