import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 401 });
    }

    const { base64Image, filename } = body;
    if (!base64Image) {
      return NextResponse.json({ error: "Missing base64Image" }, { status: 400 });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const buffer = Buffer.from(base64Image, "base64");
    const uniqueFilename = `${Date.now()}_${filename || "screenshot.png"}`;

    const { data, error } = await supabase.storage
      .from("screenshots")
      .upload(uniqueFilename, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("Supabase Storage Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from("screenshots")
      .getPublicUrl(uniqueFilename);

    return NextResponse.json({ 
      success: true, 
      url: publicUrlData.publicUrl 
    }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
