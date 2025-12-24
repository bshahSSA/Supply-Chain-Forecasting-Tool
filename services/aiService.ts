
import { GoogleGenAI, Type } from "@google/genai";
import { AiProvider, AudienceType } from "../types";

export interface MarketAdjustment {
  multiplier: number;
  reasoning: string;
  sources: { title: string; uri: string }[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const callOpenAI = async (prompt: string, contents: string) => {
  const apiKey = (process.env as any).OPENAI_API_KEY;
  if (!apiKey) return "OpenAI API Key not found in environment.";
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a world-class supply chain analyst." },
        { role: "user", content: `${prompt}\n\nContext: ${contents}` }
      ]
    })
  });
  const data = await response.json();
  return data.choices[0].message.content;
};

const callClaude = async (prompt: string, contents: string) => {
  const apiKey = (process.env as any).ANTHROPIC_API_KEY;
  if (!apiKey) return "Claude API Key not found in environment.";
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [{ role: "user", content: `${prompt}\n\nContext: ${contents}` }]
    })
  });
  const data = await response.json();
  return data.content[0].text;
};

export const getIndustryInsights = async (provider: AiProvider, prompt: string, statsSummary: string) => {
  try {
    const instruction = `Provide exactly 3 concise sentences of strategic insight for this business: "${prompt}". 
    Data Summary: ${statsSummary}.
    Requirement: 
    1. Sentence 1: Key market factor. 
    2. Sentence 2: Recommended action. 
    3. Sentence 3: Primary risk.
    Format as a single paragraph. Do not use lists or bullets.`;
    
    if (provider === AiProvider.OPENAI) return await callOpenAI(instruction, "");
    if (provider === AiProvider.CLAUDE) return await callClaude(instruction, "");
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: instruction,
      config: { 
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    return "Strategic insights currently unavailable.";
  }
};

export const getNarrativeSummary = async (
  provider: AiProvider, 
  prompt: string, 
  historicalAvg: number, 
  forecastAvg: number, 
  horizon: number, 
  audience: AudienceType,
  skus: string[]
) => {
  try {
    const trend = forecastAvg > historicalAvg ? "upward" : "downward";
    const diff = Math.abs(((forecastAvg - historicalAvg) / (historicalAvg || 1)) * 100).toFixed(1);
    
    const audienceGuidance: Record<AudienceType, string> = {
      [AudienceType.PLANT_MANAGER]: "Focus on production capacity and labor.",
      [AudienceType.DEMAND_PLANNER]: "Focus on statistical bias and safety stock.",
      [AudienceType.SALES]: "Focus on service levels and order fulfillment.",
      [AudienceType.EXECUTIVE]: "Focus on P&L impact and working capital."
    };

    const isNonExec = audience !== AudienceType.EXECUTIVE;
    const skuPrompt = isNonExec 
      ? `You MUST include a mention of 2 specific SKUs from this list [${skus.slice(0, 5).join(', ')}] as high-priority items to monitor.`
      : "Focus on strategic corporate impact.";

    const instruction = `Write a professional 3-sentence narrative for a ${audience} regarding: "${prompt}".
      Trend: ${trend} by ${diff}% over ${horizon} months.
      Audience Focus: ${audienceGuidance[audience]}.
      ${skuPrompt}
      
      Constraint: Exactly 3 sentences. Single paragraph. No introductory filler like "Here is the narrative".`;

    if (provider === AiProvider.OPENAI) return await callOpenAI(instruction, "");
    if (provider === AiProvider.CLAUDE) return await callClaude(instruction, "");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: instruction,
      config: { 
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text;
  } catch (error) {
    return "Business narrative generation failed.";
  }
};

export const getMarketTrendAdjustment = async (provider: AiProvider, prompt: string): Promise<MarketAdjustment> => {
  try {
    if (provider === AiProvider.GEMINI) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research current market trends for: "${prompt}". Return JSON with: multiplier (number), reasoning (string).`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              multiplier: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["multiplier", "reasoning"]
          }
        }
      });

      const text = response.text?.trim() || "{}";
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
      
      const sources: { title: string; uri: string }[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        });
      }

      return {
        multiplier: data.multiplier || 1.0,
        reasoning: data.reasoning || "Trend data parsed.",
        sources: sources.slice(0, 5)
      };
    }
    
    return { multiplier: 1.05, reasoning: "Standard growth adjustment applied (Non-search provider).", sources: [] };
  } catch (error) {
    return { multiplier: 1.0, reasoning: "Adjustment error.", sources: [] };
  }
};

export const getChatResponse = async (
  provider: AiProvider,
  history: ChatMessage[],
  context: string,
  userMessage: string,
  audience: AudienceType
) => {
  try {
    const systemInstruction = `You are an expert supply chain AI assistant for SSA & Company. 
    Audience Persona: ${audience}.
    Context Data: ${context}.
    Instruction: Answer questions accurately based on the provided dashboard data. Be professional, data-driven, and concise. 
    If the data doesn't contain an answer, state that. Do not hallucinate numbers.`;

    if (provider === AiProvider.GEMINI) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // We send the history manually to maintain consistency across provider implementations
      const contents = [
        { role: 'user', parts: [{ text: systemInstruction }] },
        ...history.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: { temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } }
      });
      return response.text;
    }

    if (provider === AiProvider.OPENAI) {
      const apiKey = (process.env as any).OPENAI_API_KEY;
      if (!apiKey) return "Error: OpenAI API Key missing.";
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemInstruction },
            ...history,
            { role: "user", content: userMessage }
          ]
        })
      });
      const data = await response.json();
      return data.choices[0].message.content;
    }

    if (provider === AiProvider.CLAUDE) {
      const apiKey = (process.env as any).ANTHROPIC_API_KEY;
      if (!apiKey) return "Error: Claude API Key missing.";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          system: systemInstruction,
          messages: [
            ...history,
            { role: "user", content: userMessage }
          ]
        })
      });
      const data = await response.json();
      return data.content[0].text;
    }

    return "Provider not supported.";
  } catch (error) {
    console.error("Chat API Error:", error);
    return "I encountered an error processing that request. Please try again.";
  }
};
