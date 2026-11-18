import { displays } from './ui/benches/displays.js'
export function register(kernel) {
  kernel.implement('display', 'vision-complete/attentionRoles', displays['vision-complete/attentionRoles'])
  kernel.implement('display', 'vision-complete/separableKernels', displays['vision-complete/separableKernels'])
  kernel.implement('display', 'vision-complete/appleChannels', displays['vision-complete/appleChannels'])
  kernel.implement('display', 'vision-complete/appleDecision', displays['vision-complete/appleDecision'])
  kernel.implement('display', 'vision-complete/houghPlanes', displays['vision-complete/houghPlanes'])
  kernel.implement('display', 'vision-complete/ransacTrial', displays['vision-complete/ransacTrial'])
  kernel.implement('display', 'vision-complete/ransacCases', displays['vision-complete/ransacCases'])
  kernel.implement('display', 'vision-complete/coverPairs', displays['vision-complete/coverPairs'])
  kernel.implement('display', 'vision-complete/coverPairList', displays['vision-complete/coverPairList'])
  kernel.implement('display', 'vision-complete/ganChart', displays['vision-complete/ganChart'])
  kernel.implement('display', 'vision-complete/embedding', displays['vision-complete/embedding'])
  kernel.implement('display', 'vision-complete/choiceMatrix', displays['vision-complete/choiceMatrix'])
  kernel.implement('display', 'vision-complete/kernelRound', displays['vision-complete/kernelRound'])
  kernel.implement('display', 'vision-complete/kernelChoices', displays['vision-complete/kernelChoices'])
}
