import { SemVer, compare, maxSatisfying, minSatisfying } from '../index.js'
const releases = [
  '0.1.4',
  '0.1.4+1',
  '0.1.4+2',
  '0.1.4+3',
  '0.1.5',
  '0.1.5+1',
  '0.1.5+2',
]
console.dir(new SemVer('v1.2.3-alpha.1+test'))
console.log(compare('0.1.4+1', '0.1.4+3'))
console.log(maxSatisfying(releases, '0.1.5+2'))
console.log(minSatisfying(releases, '0.1.5+2'))
