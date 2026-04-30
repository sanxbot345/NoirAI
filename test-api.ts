import { OpenAI } from 'openai';

async function testEndpoint(baseURL, model, key) {
  const openai = new OpenAI({
    apiKey: key,
    baseURL
  });

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 5
    });
    console.log(`SUCCESS with ${baseURL}`);
    return true;
  } catch (err) {
    console.log(`FAILED with ${baseURL} for key ${key}: ${err.message}`);
    return false;
  }
}

async function run() {
  await testEndpoint("https://api.deepseek.com/v1", "deepseek-chat", "sk-12345678123456781234567812345678");
  await testEndpoint("https://api.deepseek.com/v1", "deepseek-chat", "sk-567186ed5d74487183910690a51c4a90");
}

run();
