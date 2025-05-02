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
  icon: 'M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L16.53,14.47L14,17L8.93,11.93L5.18,18.43C5.07,18.59 5,18.79 5,19M13,10A1,1 0 0,0 12,11A1,1 0 0,0 13,12A1,1 0 0,0 14,11A1,1 0 0,0 13,10Z',
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
