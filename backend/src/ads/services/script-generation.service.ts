import { Injectable } from '@nestjs/common';
import { CreativeBrief } from '../types/creative-brief';
import { GeneratedScript } from '../types/generated-script';

@Injectable()
export class ScriptGenerationService {
  generate(brief: CreativeBrief): GeneratedScript {
    const title = brief.product_name
      ? `${brief.product_name} social ad`
      : 'Social ad concept';

    const hook = brief.offer
      ? `Here is why ${brief.offer}`
      : brief.product_name
        ? `Discover ${brief.product_name}`
        : 'Discover something worth trying';

    const bodyParts = [
      brief.audience ? `Made for ${brief.audience}.` : undefined,
      brief.benefits?.length
        ? `Key benefits: ${brief.benefits.join(', ')}.`
        : undefined,
      brief.tone ? `Keep the tone ${brief.tone}.` : undefined,
      brief.visual_style
        ? `Visual direction: ${brief.visual_style}.`
        : undefined,
    ].filter(Boolean);

    const body = bodyParts.length
      ? bodyParts.join(' ')
      : 'Create a short, clear product-focused ad.';
    const cta = brief.cta ?? 'Try it now.';
    const full_text = [hook, body, cta].filter(Boolean).join(' ');

    const visual_description = [
      brief.visual_style ? `Visual style: ${brief.visual_style}.` : undefined,
      brief.key_message ? `Key message: ${brief.key_message}.` : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      title,
      hook,
      body,
      cta,
      full_text,
      visual_description,
    };
  }
}
