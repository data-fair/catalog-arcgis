import type { CatalogPlugin, CatalogMetadata, CatalogDataset } from '@data-fair/lib-common-types/catalog/index.js'
import type { MapServerResponse } from '#types'

import { schema as configSchema, assertValid as assertConfigValid, type ArcGISConfig } from './types/config/index.ts'
import { memoizedFetch, listServices } from './lib/utils.ts'

// API Doc: https://developers.arcgis.com/rest/services-reference/enterprise/get-started-with-the-services-directory/

const listDatasets = async (catalogConfig: ArcGISConfig, params?: { q?: string }) => {
  const services = await listServices(catalogConfig.url)
  const datasets: CatalogDataset[] = []

  for (const service of services) {
    // if (service.type === 'FeatureServer' || service.type === 'MapServer') {
    if (service.type === 'MapServer') {
      const serviceUrl = catalogConfig.url + service.name + '/' + service.type
      const featureServer: MapServerResponse = await memoizedFetch(serviceUrl)

      const dataset: CatalogDataset = {
        id: `${service.name}`,
        title: `${service.name} (${service.type})`,
        origin: serviceUrl,
        resources: []
      }

      if (featureServer.layers && featureServer.layers.length > 0) {
        for (const layer of featureServer.layers) {
          if (layer.type === 'Group Layer') continue

          const layerUrl = serviceUrl + '/' + layer.id
          let resourceTitle = layer.name

          // Handle Feature Layer with parent
          if (layer.parentLayerId !== -1) {
            const parentLayer = featureServer.layers.find(l => l.id === layer.parentLayerId)
            if (parentLayer) {
              resourceTitle = `${parentLayer.name} - ${layer.name}`
            }
          }

          dataset.resources!.push({
            id: `${service.name}-${layer.id}`,
            title: resourceTitle,
            url: layerUrl + '/query?f=geojson&outFields=*&where=shape+is+not+null',
            format: 'geojson',
            mimeType: 'application/geo+json'
          })
        }
        datasets.push(dataset)
      }
    }
  }

  return {
    count: datasets.length,
    results: datasets
  }
}

const getDataset = async (catalogConfig: ArcGISConfig, datasetId: string) => {
  const datasetList = (await listDatasets(catalogConfig)).results
  const dataset = datasetList.find(d => d.id === datasetId)
  if (!dataset?.origin) return
  const extendedInfo = await memoizedFetch(dataset.origin)
  dataset.description = extendedInfo.description
  return dataset
}

const capabilities = ['listDatasets' as const]

const metadata: CatalogMetadata<typeof capabilities> = {
  title: 'Catalog ArcGIS',
  description: 'Importez des données géospatiales provenant de services ArcGIS.',
  capabilities
}

const plugin: CatalogPlugin<ArcGISConfig, typeof capabilities> = {
  listDatasets,
  getDataset,
  configSchema,
  assertConfigValid,
  metadata
}
export default plugin
