# Agent Type System Architecture

## Overview

The agent module uses a dual-type system with a centralized conversion layer to maintain compatibility with existing ads services while providing a clean, modern interface for the agent pipeline.

## Type Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Contracts                          │
│              (agent/contracts/*.ts)                         │
│                                                             │
│  - NormalizedRequest    - AdScript                         │
│  - ProductContext       - VeoPrompt                        │
│  - CreativeBrief        - VeoOutput                        │
│  - Scenario             - SubtitleData                     │
│  - ScenarioSet          - RenderTimeline                   │
│  - FinalOutput                                             │
│                                                             │
│  Naming: camelCase                                         │
│  Usage: Agent stages, orchestrator                         │
└─────────────────────────────────────────────────────────────┘
                            ↕
                      DtoMapper
                   (Conversion Layer)
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Ads Types                              │
│                (ads/types/*.ts)                             │
│                                                             │
│  - CreativeBrief                                           │
│  - GeneratedScript                                         │
│  - VeoScenePrompt                                          │
│  - Scene                                                   │
│                                                             │
│  Naming: snake_case                                        │
│  Usage: Ads services (legacy)                             │
└─────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Single Source of Truth

**Agent Contracts** are the canonical types for the agent system:
- All agent stages use agent contracts
- All orchestrator logic uses agent contracts
- All new features should use agent contracts

### 2. Conversion Layer

**DtoMapper** is the ONLY place where conversion happens:
- Converts agent contracts → ads DTOs (for calling ads services)
- Converts ads DTOs → agent contracts (for receiving results)
- Centralized logic eliminates duplication
- Type-safe conversions with explicit mappings

### 3. Legacy Compatibility

**Ads Types** remain for backward compatibility:
- Used by existing ads services
- Maintained for external API compatibility
- Will be gradually migrated to agent contracts

## Usage Guidelines

### For Agent Stages

Always use agent contracts:

```typescript
import { CreativeBrief } from '../contracts/creative-brief';
import { AdScript } from '../contracts/ad-script';

@Injectable()
export class MyStageService {
  async process(brief: CreativeBrief): Promise<AdScript> {
    // Use agent contracts directly
  }
}
```

### For Adapter Services

Use DtoMapper for conversions:

```typescript
import { DtoMapper } from '../utils';
import { CreativeBrief } from '../contracts/creative-brief';

@Injectable()
export class MyAdapterService {
  async callAdsService(brief: CreativeBrief) {
    // Convert to ads format
    const adsBrief = DtoMapper.toAdsBrief(brief);
    
    // Call ads service
    const adsResult = await this.adsService.generate(adsBrief);
    
    // Convert back to agent format
    return DtoMapper.toAgentScript(adsResult, jobId, scenarioId);
  }
}
```

### For New Features

Always use agent contracts:

```typescript
// ✅ Good
import { CreativeBrief } from '../contracts/creative-brief';

// ❌ Bad
import { CreativeBrief } from '../../ads/types/creative-brief';
```

## Type Naming Conventions

### Agent Contracts (camelCase)

```typescript
interface CreativeBrief {
  productName: string;
  keyBenefits: string[];
  targetPlatform: string;
  targetDuration: number;
}
```

### Ads Types (snake_case)

```typescript
interface CreativeBrief {
  product_name: string;
  benefits: string[];
  platform: string;
  duration_sec: number;
}
```

## Conversion Examples

### Brief Conversion

```typescript
// Agent → Ads
const adsBrief = DtoMapper.toAdsBrief(agentBrief);

// Ads → Agent
const agentBrief = DtoMapper.toAgentBrief(adsBrief, productContext);
```

### Script Conversion

```typescript
// Agent → Ads
const adsScript = DtoMapper.toAdsScript(agentScript);

// Ads → Agent
const agentScript = DtoMapper.toAgentScript(adsScript, jobId, scenarioId);
```

### Platform Mapping

```typescript
// Agent → Ads
const adsPlatform = PlatformMapper.toAdsFormat('instagram_reels'); // 'instagram'

// Ads → Agent
const agentPlatform = PlatformMapper.toAgentFormat('instagram'); // 'instagram_reels'
```

## Migration Strategy

### Phase 1: Current State ✅

- Agent contracts defined
- DtoMapper implemented
- Adapter services use DtoMapper
- Ads services use ads types

### Phase 2: Future (Optional)

- Gradually update ads services to accept agent contracts
- Add overloaded signatures for backward compatibility
- Eventually deprecate ads types

### Phase 3: Final State (Long-term)

- All services use agent contracts
- Ads types removed
- Single unified type system

## Benefits

### 1. Reduced Duplication

- Single conversion point (DtoMapper)
- No duplicate conversion logic in adapters
- Centralized platform mapping

### 2. Type Safety

- Explicit type conversions
- Compile-time type checking
- No `any` types in conversions

### 3. Maintainability

- Easy to update conversion logic
- Clear separation of concerns
- Testable conversion layer

### 4. Flexibility

- Can evolve agent contracts independently
- Maintains backward compatibility
- Gradual migration path

## Testing

All conversions are tested in `dto-mapper.spec.ts`:

```typescript
describe('DtoMapper', () => {
  it('should convert agent brief to ads brief', () => {
    const agentBrief: CreativeBrief = { /* ... */ };
    const adsBrief = DtoMapper.toAdsBrief(agentBrief);
    
    expect(adsBrief.product_name).toBe(agentBrief.productName);
    expect(adsBrief.benefits).toEqual(agentBrief.keyBenefits);
  });
  
  it('should maintain round-trip consistency', () => {
    const original: CreativeBrief = { /* ... */ };
    const ads = DtoMapper.toAdsBrief(original);
    const back = DtoMapper.toAgentBrief(ads, productContext);
    
    expect(back.productName).toBe(original.productName);
  });
});
```

## Summary

The agent type system is designed for:
- **Clarity**: Agent contracts are the source of truth
- **Compatibility**: Ads types maintained for legacy services
- **Consistency**: DtoMapper ensures correct conversions
- **Maintainability**: Centralized conversion logic

This architecture eliminates duplication while maintaining backward compatibility and providing a clear migration path for the future.
