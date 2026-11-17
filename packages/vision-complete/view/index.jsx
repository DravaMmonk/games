import { displays } from './ui/benches/displays.js'
export { displays } from './ui/benches/displays.js'
export function register(kernel) {
  kernel.display('vision-complete/attentionRoles', displays['vision-complete/attentionRoles'])
  kernel.display('vision-complete/separableKernels', displays['vision-complete/separableKernels'])
  kernel.display('vision-complete/appleChannels', displays['vision-complete/appleChannels'])
  kernel.display('vision-complete/appleDecision', displays['vision-complete/appleDecision'])
  kernel.display('vision-complete/houghPlanes', displays['vision-complete/houghPlanes'])
  kernel.display('vision-complete/ransacTrial', displays['vision-complete/ransacTrial'])
  kernel.display('vision-complete/ransacCases', displays['vision-complete/ransacCases'])
  kernel.display('vision-complete/coverPairs', displays['vision-complete/coverPairs'])
  kernel.display('vision-complete/coverPairList', displays['vision-complete/coverPairList'])
  kernel.display('vision-complete/ganChart', displays['vision-complete/ganChart'])
  kernel.display('vision-complete/embedding', displays['vision-complete/embedding'])
  kernel.display('vision-complete/choiceMatrix', displays['vision-complete/choiceMatrix'])
  kernel.display('vision-complete/kernelRound', displays['vision-complete/kernelRound'])
  kernel.display('vision-complete/kernelChoices', displays['vision-complete/kernelChoices'])
}
