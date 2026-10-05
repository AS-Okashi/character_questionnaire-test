window.SURVEY_CONFIG = {
  surveyVersion: "2026.09.14-comparison-layout-v5",
  // GASをウェブアプリとしてデプロイ後、/exec URLを設定してください。
  gasEndpoint: "https://script.google.com/macros/s/AKfycbxDAu_zdUunwNPaIWfdt7R9XfugZIurRctP9SAy5hrp2wCkvrWJ30T1loL1Ns89uKl5/exec",
  requireGasEndpointForFinalSubmit: true,
  transformImagePath(characterId, variantId) {
    return `../assets/survey/transforms/${characterId}/${variantId}.png`;
  }
};
