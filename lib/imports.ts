import type { ArcGISConfig, ArcGISLayer, ArcGISSchemas, ArcGISService, ArcGISSubLayer } from '#types'
import type { ListContext, Folder } from '@data-fair/types-catalogs'
import type CatalogPlugin from '@data-fair/types-catalogs'
import type { ArcGISCapabilities } from './capabilities.ts'
import debugLib from 'debug'
import memoize from 'memoize'
import axios from 'axios'

type ResourceList = Awaited<ReturnType<CatalogPlugin['list']>>['results']

const debug = debugLib('catalogs:arcgis')

const memoizedFetch = memoize(async (url: string) => {
  return (await axios.get(url, { params: { f: 'json' } })).data
}, {
  maxAge: 1000 * 60 * 5 // 5 minutes
})

/**
 * Lists folders, services, and layers from an ArcGIS catalog endpoint.
 *
 * This function fetches the ArcGIS catalog data from the specified URL or current folder,
 * then parses and returns a list of datasets (folders and resources) and the navigation path.
 * It supports folders, FeatureServer/MapServer services, group layers, feature layers, and sublayers.
 *
 * @param context - The context object containing the catalog configuration and parameters.
 * @param context.catalogConfig - The ArcGIS catalog configuration, including the base URL.
 * @param context.params - Parameters for listing, such as the current folder ID.
 * @returns An object containing:
 *   - `results`: Array of folders and resources found at the current level.
 *   - `count`: The number of items in `results`.
 *   - `path`: The navigation path as an array of folders.
 */
export const list = async ({ catalogConfig, params }: ListContext<ArcGISConfig, ArcGISCapabilities>): ReturnType<CatalogPlugin['list']> => {
  debug(`list folders/services/layers from ${catalogConfig.url} - ${params.currentFolderId}`)

  let url = catalogConfig.url
  if (params.currentFolderId) {
    url = params.currentFolderId
  }

  const rootData: ArcGISSchemas = (await memoizedFetch(url))
  const datasets: (Folder | ResourceList[number])[] = []

  if (rootData.folders && Array.isArray(rootData.folders)) {
    rootData.folders.forEach((folder: string) => {
      datasets.push({
        id: url + '/' + folder,
        title: folder,
        type: 'folder'
      } as Folder)
    })
  }

  if (rootData.services && Array.isArray(rootData.services)) {
    rootData.services.forEach((service: ArcGISService) => {
      if (service.type === 'FeatureServer' || service.type === 'MapServer') {
        const serviceUrl = service.url ?? (catalogConfig.url + service.name + '/' + service.type)
        datasets.push({
          id: serviceUrl,
          title: `${service.name} (${service.type})`,
          type: 'folder'
        } as Folder)
      }
    })
  }

  if (rootData.layers && Array.isArray(rootData.layers)) {
    rootData.layers.forEach((layer: ArcGISLayer) => {
      if (layer.type === 'Group Layer') {
        datasets.push({
          id: url + '/' + layer.id,
          title: `${layer.name} - ${layer.id}`,
          type: 'folder'
        } as Folder)
      } else if ((layer.type === 'Feature Layer' || layer.type === 'Annotation Layer') && layer.parentLayerId === -1) {
        datasets.push({
          id: url + '/' + layer.id,
          title: `${layer.name} - ${layer.id}`,
          origin: url + '/' + layer.id,
          type: 'resource',
          format: 'geojson',
          filePath: '',
        } as ResourceList[number])
      } else {
        // autres types non pris en charge
      }
    })
  }

  if (rootData.subLayers && Array.isArray(rootData.subLayers)) {
    rootData.subLayers.forEach((layer: ArcGISSubLayer) => {
      datasets.push({
        id: url.substring(0, url.lastIndexOf('/') + 1) + layer.id,
        title: `${layer.name} - ${layer.id}`,
        type: 'resource',
        format: 'geojson',
      } as ResourceList[number])
    })
  }

  const path: Folder[] = []
  const elts = url.substring(catalogConfig.url.length).split('/')
  elts.forEach((elt) => {
    if (elt === 'FeatureServer' || elt === 'MapServer') {
      const lastElt = path.pop()
      if (lastElt) {
        lastElt.id += '/' + elt
        path.push(lastElt)
      }
    } else if (elt !== '') {
      path.push({
        id: url.substring(0, url.indexOf('/' + elt) + elt.length + 1),
        title: elt,
        type: 'folder'
      })
    }
  })

  return {
    results: datasets,
    count: datasets.length,
    path
  }
}
