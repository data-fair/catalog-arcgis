import { type ArcGISCapabilities, capabilities } from './lib/capabilities.ts'
import { schema as configSchema, assertValid as assertConfigValid, type ArcGISConfig } from './types/config/index.ts'
import type { CatalogPlugin } from '@data-fair/lib-common-types/catalog/index.js'

const plugin: CatalogPlugin<ArcGISConfig, ArcGISCapabilities> = {
  async prepare () {
    return {}
  },

  async list (context) {
    const { list } = await import('./lib/imports.ts')
    return list(context)
  },

  async getResource (context) {
    const { getResource } = await import('./lib/download.ts')
    return getResource(context)
  },

  configSchema,
  assertConfigValid,
  metadata: {
    title: 'Catalog ArcGIS',
    description: 'Importez des données géospatiales provenant de services ArcGIS.',
    capabilities
  }
}
export default plugin
