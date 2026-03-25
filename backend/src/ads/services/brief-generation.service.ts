import { Injectable } from '@nestjs/common';
import { CreateAdDto } from '../dto/create-ad.dto';
import { CreativeBrief } from '../types/creative-brief';
import { VertexAiService } from '../../ai/vertex-ai.service';

@Injectable()
export class BriefGenerationService {
  constructor(private readonly vertexAiService: VertexAiService) {}

  async generate(createAdDto: CreateAdDto): Promise<CreativeBrief> {
    const { prompt_inputs, veo_config } = createAdDto;

    // If we have product info, use LLM to generate a creative brief
    if (
      prompt_inputs.product_info?.name ||
      prompt_inputs.product_info?.description
    ) {
      const prompt = `
        You are an expert advertising strategist specializing in short-form social video ads.
        
        Given the following inputs, create a structured creative brief for a ${veo_config.duration_sec}-second ${prompt_inputs.platform} ad.
        
        User prompt: ${typeof prompt_inputs.prompt === 'string' ? prompt_inputs.prompt : JSON.stringify(prompt_inputs.prompt)}
        Product name: ${prompt_inputs.product_info?.name || 'Not provided'}
        Product description: ${prompt_inputs.product_info?.description || 'Not provided'}
        Product benefits: ${prompt_inputs.product_info?.benefits?.join(', ') || 'Not provided'}
        Target audience: ${prompt_inputs.target_audience || 'Infer from product context'}
        Tone: ${prompt_inputs.tone || 'direct'}
        Language: ${prompt_inputs.language || 'en'}
        CTA: ${prompt_inputs.cta || 'Suggest an appropriate CTA'}
        
        Requirements:
        - The brief must be specific enough to produce a coherent ad script
        - Infer any missing fields from context
        - The visual style should match the tone and platform
        - The ad must fit within ${veo_config.duration_sec} seconds when spoken aloud
        
        Respond with a JSON object matching this exact schema:
        {
          "product_name": "string",
          "offer": "string",
          "audience": "string",
          "pain_points": ["string"],
          "benefits": ["string"],
          "tone": "string",
          "language": "string",
          "duration_sec": number,
          "platform": "string",
          "cta": "string",
          "visual_style": "string",
          "aspect_ratio": "string",
          "key_message": "string",
          "proof_points": ["string"]
        }
      `;

      try {
        const result = await this.vertexAiService.generateContent(prompt);
        if (result && typeof result === 'object') {
          return result as CreativeBrief;
        }
      } catch (error) {
        // If LLM fails, fall back to the simple implementation
        console.warn(
          'LLM brief generation failed, using fallback implementation:',
          error,
        );
      }
    }

    // Fallback implementation for when LLM is not available or fails
    const benefits = prompt_inputs.product_info?.benefits?.filter(Boolean);

    return {
      product_name: prompt_inputs.product_info?.name || undefined,
      offer: prompt_inputs.product_info?.description || undefined,
      audience: prompt_inputs.target_audience || undefined,
      pain_points: undefined,
      benefits: benefits?.length ? benefits : undefined,
      tone: prompt_inputs.tone || undefined,
      language: prompt_inputs.language || undefined,
      duration_sec: veo_config.duration_sec || undefined,
      platform: prompt_inputs.platform || undefined,
      cta: prompt_inputs.cta || undefined,
      visual_style: prompt_inputs.subtitle_style || undefined,
      aspect_ratio: veo_config.aspect_ratio || undefined,
    };
  }
}
