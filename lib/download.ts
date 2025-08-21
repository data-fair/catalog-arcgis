import type { ArcGISConfig, ArcGISLayer } from '#types'
import type { CatalogPlugin, GetResourceContext, Resource } from '@data-fair/types-catalogs'
import axios from '@data-fair/lib-node/axios.js'
import fs from 'fs'
import path from 'path'
import debugLib from 'debug'

const debug = debugLib('catalogs:arcgis')
// examples of urls
// https://services-eu1.arcgis.com/gONSMkhTYE5RuOwN/ArcGIS
// https://sig.grandpoitiers.fr/arcgis2/rest/services

/**
 * Retrieves a resource's metadata and downloads the associated file. The resource must be a `Feature Layer`or a `Annotation Layer`.
 *
 * @param context - The context containing configuration and parameters for retrieving the resource.
 * @returns A promise that resolves to the resource object with an updated `filePath` property pointing to the downloaded file.
 */
export const getResource = async (context: GetResourceContext<ArcGISConfig>): ReturnType<CatalogPlugin['getResource']> => {
  const resource = await getMetaData(context)
  resource.filePath = await downloadResource(context, resource.title)
  return resource
}

/**
 * Fetches and returns metadata for an ArcGIS resource specified by its resourceId.
 *
 * This function retrieves the metadata of the given ArcGIS resource, checks if the resource
 * is of type `Feature Layer`or `Annotation Layer` and constructs a `Resource` object with relevant information.
 * If the resource is not a `Feature Layer`or a `Annotation Layer`, an error is thrown.
 *
 * @param context - An object containing the `resourceId` of the ArcGIS resource to fetch metadata for.
 * @returns A promise that resolves to a `Resource` object containing metadata about the ArcGIS resource.
 * @throws Will throw an error if the resource type is not `Feature Layer`or `Annotation Layer`.
 */
const getMetaData = async ({ resourceId }: GetResourceContext<ArcGISConfig>): Promise<Resource> => {
  debug(`fetching metadata of ${resourceId}`)

  const url = resourceId + '?f=json'
  const data: ArcGISLayer = (await axios.get(url)).data
  if (data.type !== 'Feature Layer' && data.type !== 'Annotation Layer') {
    console.error(`error : attempt to download a file from arcGIS with a ${data.type} type`)
    throw new Error(`Les ressources ArcGIS pouvant être importées doivent être de type 'Feature Layer' ou 'AnnotationLayer' (type reçu : ${data.type})`)
  }

  return {
    id: resourceId,
    title: `${data.name}-${data.id}`,
    format: 'geojson',
    origin: resourceId,
    filePath: '',
    description: data.description
  }
}

/**
 * Downloads a GeoJSON resource from an ArcGIS endpoint and saves it to a temporary directory.
 *
 * @param context - An object containing the `resourceId` (ArcGIS resource URL) and `tmpDir` (temporary directory path).
 * @param fileName - The desired name for the downloaded file (without extension).
 * @returns A promise that resolves to the full file path of the saved GeoJSON file.
 * @throws Throws an error if the download or file write operation fails.
 */
const downloadResource = async ({ resourceId, tmpDir }: GetResourceContext<ArcGISConfig>, fileName: string): Promise<string> => {
  debug(`fetch and download data from ${resourceId}`)

  try {
    fileName = fileName.replace(/[\s/]/g, '_') + '.geojson'
    const filePath = path.join(tmpDir, fileName)
    const baseUrl = resourceId + '/query'
    let features: any[] = []
    let hasMore = true
    let resultOffset = 0
    const pageSize = 1000 // ArcGIS default max record count is often 1000
    let type: string | undefined

    let geojsonTemplate = {}
    while (hasMore) {
      const params = new URLSearchParams({
        where: '1=1',
        f: 'geojson',
        outFields: '*',
        resultOffset: resultOffset.toString(),
        resultRecordCount: pageSize.toString()
      })
      const response = await axios.get(baseUrl, { params })
      if (response.status !== 200) {
        throw new Error(`Erreur lors du téléchargement ${JSON.stringify(response)}`)
      }
      const data = response.data
      if (!type && data.type) {
        type = data.type
      }
      if (Array.isArray(data.features)) {
        features = features.concat(data.features)
      }
      // Check if transfer limit exceeded
      if (data.exceededTransferLimit) {
        resultOffset += pageSize
        hasMore = true
      } else {
        hasMore = false
      }
      // On first page, keep the structure for later
      if (resultOffset === 0) {
        geojsonTemplate = { ...data, features: [] }
      }
    }

    // Compose the final GeoJSON, ensure type is set
    const finalGeojson = { ...geojsonTemplate, type, features }

    fs.writeFileSync(filePath, JSON.stringify(finalGeojson))

    return filePath
  } catch (error) {
    console.error('Error fetching data:', error)
    throw new Error('Error pendant le téléchargement du fichier')
  }
}
