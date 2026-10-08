import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
        timeout: 35000,
    },
});

export async function POST(req: NextRequest) {
    try {
        const { prompt, imageBase64, mimeType, isFirstTurn } = await req.json();

        const contents: any[] = [];

        if (imageBase64 && mimeType) {
            contents.push({
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType,
                },
            });
        }

        contents.push(prompt || "Transcribe and analyze this document clearly.");

        let replyText = "";
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.5-flash-lite",
                contents,
            });
            replyText = response.text || "";
        } catch (liteErr: any) {
            console.warn("Lite model failed, switching to gemini-3.8-flash:", liteErr?.message);
            const response = await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents,
            });
            replyText = response.text || "";
        }

        // Auto-generate title for the session history if it's the start of a chat
        let detectedTitle: string | undefined = undefined;
        if (isFirstTurn && replyText) {
            try {
                const titleRes = await ai.models.generateContent({
                    model: "gemini-3.5-flash-lite",
                    contents: [
                        `Based on this visual analysis summary: "${replyText.slice(0, 300)}", generate a 3 to 4 word concise title describing the subject (e.g. "IEEE Council Logo", "Handwritten Complaint Letter", "JWST Cosmic Cliffs"). Output ONLY the title, no quotes or punctation.`,
                    ],
                });
                detectedTitle = titleRes.text?.trim().replace(/["\n\r.]/g, "");
            } catch (err) {
                console.warn("Title summary error:", err);
            }
        }

        return NextResponse.json({ reply: replyText, title: detectedTitle });
    } catch (error: any) {
        console.error("Gemini Vision Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process image" },
            { status: 500 }
        );
    }
}