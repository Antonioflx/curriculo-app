import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

const { config: tsconfig } = ts.readConfigFile('./tsconfig.json', ts.sys.readFile);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*[.]spec[.]ts$',
  transform: { '^.+[.](t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/../' }),
  testEnvironment: 'node',
};

export default config;
