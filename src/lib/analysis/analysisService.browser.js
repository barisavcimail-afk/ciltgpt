(function () {
  function createAnalysisRequest(input) {
    return {
      ...input,
      consentAccepted: Boolean(input.consentAccepted),
      photos: input.photos || {},
      notes: input.notes || "",
    };
  }

  function getAnalysisProvider() {
    return "openaiVision";
  }

  function generateMockAnalysis() {
    throw new Error("Mock analiz devre dışı. Analizler sadece OpenAI Vision üzerinden oluşturulur.");
  }

  async function runSkinAnalysis() {
    throw new Error("Client-side analiz devre dışı. OpenAI Vision analizi server API üzerinden çalışır.");
  }

  window.CiltGPTAnalysisService = {
    createAnalysisRequest,
    generateMockAnalysis,
    getAnalysisProvider,
    runSkinAnalysis,
  };
})();
