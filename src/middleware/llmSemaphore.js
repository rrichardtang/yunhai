const MAX_CONCURRENT_LLM_CALLS = 10;
let activeLlmCalls = 0;
const llmQueue = [];

const acquire = () => new Promise((resolve) => {
  const tryAcquire = () => {
    if (activeLlmCalls < MAX_CONCURRENT_LLM_CALLS) {
      activeLlmCalls++;
      resolve();
    } else {
      llmQueue.push(tryAcquire);
    }
  };
  tryAcquire();
});

const release = () => {
  if (activeLlmCalls > 0) activeLlmCalls--;
  if (llmQueue.length > 0) llmQueue.shift()();
};

module.exports = { acquire, release, MAX_CONCURRENT_LLM_CALLS };
