# Agent Refactoring Spec

## Overview

This spec defines a comprehensive refactoring of the AI Ad Agent implementation to address code duplication, missing implementations, type safety issues, and architectural improvements identified in a code review.

## Status

- **Requirements**: ✅ Complete
- **Design**: ✅ Complete
- **Implementation**: ⏳ Ready to start
- **Testing**: ⏳ Pending
- **Documentation**: ⏳ Pending

## Documents

1. **[requirements.md](./requirements.md)** - 15 comprehensive requirements with acceptance criteria
2. **[design.md](./design.md)** - Technical design with architecture, components, and implementation phases
3. **[tasks.md](./tasks.md)** - 60 implementation tasks organized into 6 phases

## Key Objectives

### Code Quality Improvements

- **Eliminate Type Duplication**: Reduce 200+ lines of duplicate types by 80%
- **Consolidate Adapter Logic**: Reduce 150+ lines of boilerplate by 80%
- **Single Platform Mapping**: Consolidate 3 implementations into 1
- **Resolve TODOs**: Complete all 5 TODO items
- **Improve Type Safety**: Eliminate all `any` types

### Functional Improvements

- **Retry Policies**: Implement exponential backoff retry logic
- **Fallback Policies**: Implement graceful degradation
- **Output Validation**: Integrate OutputValidator in Phase 2
- **Quality Gates**: Comprehensive validation checks
- **Error Handling**: Distinguish retryable vs non-retryable errors

## Implementation Phases

### Phase 1: Create Shared Utilities (45 min)
- Extract `PlatformMapper`, `DtoMapper`, `AgentConstants`
- Update adapter services to use utilities
- Reduce boilerplate by 80%

### Phase 2: Implement Retry & Fallback Policies (90 min)
- Create `RetryPolicy` with exponential backoff
- Create `FallbackPolicy` for graceful degradation
- Integrate into orchestrator and stages

### Phase 3: Integrate OutputValidator & Quality Gates (60 min)
- Implement `OutputValidatorService`
- Add validation checks (file, duration, resolution, size, subtitles)
- Integrate into Phase 2 pipeline

### Phase 4: Type System Consolidation (60 min)
- Use agent contracts as canonical types
- Remove duplicate types from `ads/types/`
- Update imports throughout codebase

### Phase 5: Improve Type Safety (60 min)
- Replace all `any` types with explicit types
- Use string literal unions
- Add type guards for runtime validation

### Phase 6: Documentation & Cleanup (30 min)
- Update `AGENT_INTEGRATION_PLAN.md`
- Create utility and error handling guides
- Remove all TODO comments

## Success Metrics

### Code Quality
- ✅ 80% reduction in type duplication (200+ → <40 lines)
- ✅ 80% reduction in adapter boilerplate (150+ → <30 lines)
- ✅ 100% platform mapping consolidation (3 → 1 implementation)
- ✅ 100% TODO resolution (5 → 0 comments)
- ✅ 100% type safety (10+ → 0 `any` types)

### Functional
- ✅ 83+ tests passing (100% pass rate)
- ✅ Zero breaking changes (100% backward compatible)
- ✅ Retry logic implemented (2 retries with exponential backoff)
- ✅ Fallback logic implemented (4 fallback scenarios)
- ✅ Output validation implemented (5 validation checks)

### Performance
- ✅ Phase 1 duration: <30 seconds
- ✅ Phase 2 duration: <10 minutes
- ✅ Retry overhead: <5 seconds per attempt
- ✅ Validation overhead: <2 seconds per check

## Architecture Changes

### Before
```
AdsController → AdsService → AgentOrchestrator → Stage Services
                                                   ↓
                                            Duplicate conversion logic
                                            Duplicate platform mapping
                                            No retry/fallback
                                            No output validation
```

### After
```
AdsController → AdsService → AgentOrchestrator → Stage Services
                                  ↓                    ↓
                            Retry/Fallback      Shared Utilities
                            OutputValidator     (PlatformMapper, DtoMapper)
                            Quality Gates       Strong typing
```

## Risk Mitigation

### High Risk
- **Type System Migration**: Incremental migration, maintain backward compatibility
- **Retry Logic**: Max retry limit, exponential backoff, timeout

### Medium Risk
- **Fallback Quality**: Log all fallbacks, monitor quality scores
- **Test Coverage**: Add tests for all new utilities and policies

### Low Risk
- **Documentation**: Update docs in final phase
- **Performance**: Utilities are lightweight, minimal overhead

## Rollback Plan

Each phase is independently committable:
1. Phase 1: Revert shared utilities commit
2. Phase 2: Revert retry/fallback commit
3. Phase 3: Revert OutputValidator commit
4. Phase 4: Revert type consolidation commit
5. Phase 5: Revert type safety commit
6. Phase 6: Revert documentation commit

## Testing Strategy

**After Each Phase**:
1. Run `npm test` - verify all tests pass
2. Run `npm run lint` - fix linting issues
3. Run `npm run build` - verify build succeeds
4. Manual smoke test - create ad, select scenario, verify video

**Integration Testing**:
- Test Phase 1 end-to-end (scenario generation)
- Test Phase 2 end-to-end (video generation)
- Test error scenarios (retry, fallback)
- Test quality gates (validation)

## Next Steps

1. Review and approve this spec
2. Start Phase 1: Create Shared Utilities
3. Complete each phase incrementally
4. Test after each phase
5. Commit after each phase
6. Final integration testing

## Related Documents

- [AGENT_INTEGRATION_PLAN.md](../../../docs/AGENT_INTEGRATION_PLAN.md) - Original integration plan
- [Code Review Summary](../../../CONTEXT_TRANSFER_SUMMARY.md) - Issues identified

## Estimated Timeline

- **Phase 1**: 45 minutes
- **Phase 2**: 90 minutes
- **Phase 3**: 60 minutes
- **Phase 4**: 60 minutes
- **Phase 5**: 60 minutes
- **Phase 6**: 30 minutes

**Total**: 6 hours (1 working day)

## Approval

- [ ] Requirements approved
- [ ] Design approved
- [ ] Ready for implementation

---

**Spec ID**: 4e86a289-c0bd-415a-9365-66a83049f5b1
**Workflow**: Requirements-First
**Type**: Feature
**Created**: 2026-04-02
