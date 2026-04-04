# Logging Integration TODO

## Completed
- ✅ Added correlationId to AgentJobState
- ✅ Added StructuredLogger and PerformanceMonitor to AgentOrchestratorService constructor
- ✅ Added logging to initializeJob method

## Remaining Tasks

### AgentOrchestratorService

Add logging to these key methods:

1. **initializeFromWizard** (line ~124)
   - Log job initialization from wizard
   - Use existing correlationId or generate new one

2. **runScenarioGeneration** (line ~340)
   - Log start of scenario generation phase
   - Log each stage transition
   - Track performance with timer
   - Log completion with duration

3. **selectScenario** (line ~485)
   - Log scenario selection by user
   - Log selected scenario ID

4. **runVideoGeneration** (line ~569)
   - Log start of video generation phase
   - Log each stage transition
   - Track performance with timer
   - Log completion with duration

5. **transitionStage** (line ~825)
   - Log every stage transition with from/to stages
   - This is called by all stage transitions

6. **recordError** (line ~884)
   - Use ErrorTrackerService to report errors
   - Include correlation ID and context

### Example Logging Pattern

```typescript
// At start of runScenarioGeneration
const context = {
  correlationId: state.correlationId,
  jobId: state.jobId,
  businessId: state.businessId,
  stage: state.stage,
};

this.structuredLogger.log('Starting scenario generation', context);
const timer = this.performanceMonitor.startTimer('scenario-generation', context);

try {
  // ... existing code ...
  
  timer();
  this.structuredLogger.log('Scenario generation completed', {
    ...context,
    scenarioCount: scenarios.length,
  });
} catch (error) {
  timer();
  this.structuredLogger.error('Scenario generation failed', error as Error, context);
  throw error;
}
```

### Stage Transition Logging

```typescript
private transitionStage(state: AgentJobState, newStage: AgentStage): void {
  const context = {
    correlationId: state.correlationId,
    jobId: state.jobId,
    businessId: state.businessId,
    stage: state.stage,
  };
  
  this.structuredLogger.log(`Stage transition: ${state.stage} → ${newStage}`, {
    ...context,
    fromStage: state.stage,
    toStage: newStage,
  });
  
  // ... existing validation code ...
  
  state.stage = newStage;
  state.updatedAt = new Date();
}
```

### Error Logging

```typescript
private recordError(
  state: AgentJobState,
  stage: AgentStage,
  error: Error,
): void {
  const context = {
    correlationId: state.correlationId,
    jobId: state.jobId,
    businessId: state.businessId,
    stage,
  };
  
  // Use ErrorTrackerService
  this.errorTracker.reportError(
    error,
    ErrorSeverity.HIGH, // or determine based on error type
    context,
    state.correlationId,
  );
  
  // ... existing error recording code ...
}
```

## Next Steps

1. Complete logging integration in AgentOrchestratorService
2. Add logging to LLMService (Task 1.5.3)
3. Add logging to VideoGeneratorService (Task 1.5.4)
4. Add logging to all stage services (Task 1.5.5)
5. Add performance tracking to API controllers (Task 1.6)

## Testing

After integration:
1. Run a full job through the pipeline
2. Check Cloud Logging for correlation ID
3. Verify all stage transitions are logged
4. Verify errors are reported to Error Reporting
5. Check performance metrics are tracked
