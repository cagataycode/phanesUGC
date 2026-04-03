/**
 * Integration test for AWS Bedrock Claude with LlmService
 * 
 * This script tests the real AWS Bedrock API integration
 * Run with: npx ts-node --env-file=.env scripts/test-bedrock-integration.ts
 * Or: export environment variables and run: npx ts-node scripts/test-bedrock-integration.ts
 */

import { LlmService } from '../src/ai/llm.service';

// Mock ConfigService with real environment variables
class TestConfigService {
  get(key: string) {
    return process.env[key];
  }
}

async function testBriefGeneration() {
  console.log('\n🧪 Test 1: Brief Generation');
  console.log('=' .repeat(60));

  const configService = new TestConfigService() as any;
  const llmService = new LlmService(configService);

  const systemPrompt = `You are an expert advertising strategist. Generate a creative brief for a short-form video ad.

Return ONLY a valid JSON object with this structure:
{
  "product_name": "Product name",
  "offer": "Main value proposition",
  "audience": "Target audience",
  "tone": "casual",
  "key_message": "The main message"
}`;

  const userPrompt = `Create a brief for wireless earbuds targeting young professionals.`;

  try {
    console.log('📤 Sending request to LLM...');
    const startTime = Date.now();
    
    const result = await llmService.generateContent(systemPrompt, userPrompt);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Success! (${duration}ms)`);
    console.log('\n📋 Generated Brief:');
    console.log(JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testScriptGeneration() {
  console.log('\n🧪 Test 2: Script Generation');
  console.log('=' .repeat(60));

  const configService = new TestConfigService() as any;
  const llmService = new LlmService(configService);

  const systemPrompt = `You are an expert scriptwriter. Generate an 8-second ad script.

Return ONLY a valid JSON object with this structure:
{
  "title": "Script title",
  "hook": "Opening line",
  "body": "Main message",
  "cta": "Call to action",
  "full_text": "Complete script"
}`;

  const userPrompt = `Write a script for wireless earbuds emphasizing sound quality and comfort.`;

  try {
    console.log('📤 Sending request to LLM...');
    const startTime = Date.now();
    
    const result = await llmService.generateContent(systemPrompt, userPrompt);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Success! (${duration}ms)`);
    console.log('\n📝 Generated Script:');
    console.log(JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testScenarioGeneration() {
  console.log('\n🧪 Test 3: Scenario Generation (Array Response)');
  console.log('=' .repeat(60));

  const configService = new TestConfigService() as any;
  const llmService = new LlmService(configService);

  const systemPrompt = `You are a creative director. Generate 2 distinct ad scenarios.

Return ONLY a valid JSON array with exactly 2 objects:
[
  {
    "scenarioId": 1,
    "title": "Scenario name",
    "hook": "Opening line",
    "angle": "persuasion strategy",
    "tone": "serious"
  },
  {
    "scenarioId": 2,
    "title": "Different scenario",
    "hook": "Different opening",
    "angle": "different strategy",
    "tone": "funny"
  }
]`;

  const userPrompt = `Generate 2 scenarios for wireless earbuds.`;

  try {
    console.log('📤 Sending request to LLM...');
    const startTime = Date.now();
    
    const result = await llmService.generateContent(systemPrompt, userPrompt);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Success! (${duration}ms)`);
    console.log('\n🎬 Generated Scenarios:');
    console.log(JSON.stringify(result, null, 2));
    
    // Validate it's an array
    if (Array.isArray(result)) {
      console.log(`\n✅ Correctly returned array with ${result.length} scenarios`);
    } else {
      console.log('\n⚠️  Warning: Expected array but got object');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testComplexStructure() {
  console.log('\n🧪 Test 4: Complex Nested Structure');
  console.log('=' .repeat(60));

  const configService = new TestConfigService() as any;
  const llmService = new LlmService(configService);

  const systemPrompt = `You are a scene director. Generate a video scene prompt.

Return ONLY a valid JSON object with nested structure:
{
  "scene_id": 1,
  "duration_seconds": 8,
  "prompt": {
    "intent": "Scene description",
    "shot": {
      "type": "product_showcase",
      "framing": "close-up",
      "camera_motion": "slow_push_in"
    },
    "audio": {
      "speech_text": "Full narration text",
      "speech_style": "conversational"
    }
  }
}`;

  const userPrompt = `Generate a scene for wireless earbuds product showcase.`;

  try {
    console.log('📤 Sending request to LLM...');
    const startTime = Date.now();
    
    const result = await llmService.generateContent(systemPrompt, userPrompt);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Success! (${duration}ms)`);
    console.log('\n🎥 Generated Scene:');
    console.log(JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function runAllTests() {
  console.log('\n🚀 AWS Bedrock Claude Integration Tests');
  console.log('=' .repeat(60));
  console.log(`Model: ${process.env.BEDROCK_MODEL_ID}`);
  console.log(`Region: ${process.env.AWS_REGION}`);
  console.log(`Fallback: ${process.env.GEMINI_API_KEY ? 'Enabled (Gemini)' : 'Disabled'}`);
  console.log('=' .repeat(60));

  const results = {
    briefGeneration: false,
    scriptGeneration: false,
    scenarioGeneration: false,
    complexStructure: false,
  };

  // Run tests sequentially
  results.briefGeneration = await testBriefGeneration();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit pause

  results.scriptGeneration = await testScriptGeneration();
  await new Promise(resolve => setTimeout(resolve, 1000));

  results.scenarioGeneration = await testScenarioGeneration();
  await new Promise(resolve => setTimeout(resolve, 1000));

  results.complexStructure = await testComplexStructure();

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Summary');
  console.log('=' .repeat(60));
  console.log(`Brief Generation:     ${results.briefGeneration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Script Generation:    ${results.scriptGeneration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Scenario Generation:  ${results.scenarioGeneration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Complex Structure:    ${results.complexStructure ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log('\n' + '=' .repeat(60));
  console.log(`Overall: ${passCount}/${totalCount} tests passed`);
  console.log('=' .repeat(60));

  if (passCount === totalCount) {
    console.log('\n🎉 All integration tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check logs above.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
