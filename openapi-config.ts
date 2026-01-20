// openapi-config.ts (in root of frontend)
import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: 'http://localhost:8000/openapi.json',
  apiFile   : './src/store/emptyApi.ts',
  apiImport : 'emptySplitApi',
  outputFile: './src/store/tubxz_api.ts',
  exportName: 'tubxz_api',
  hooks     : true,
  tag       : true,
};

export default config;