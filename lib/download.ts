import type { ArcGISConfig, ArcGISLayer } from '#types'
import type { CatalogPlugin, GetResourceContext, Resource } from '@data-fair/types-catalogs'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import debugLib from 'debug'

const debug = debugLib('catalogs:arcgis')
// examples of urls
// https://services-eu1.arcgis.com/gONSMkhTYE5RuOwN/ArcGIS
// https://sig.grandpoitiers.fr/arcgis2/rest/services

/**
 * Retrieves a resource's metadata and downloads the associated file. The resource must be a `FeatureLayer`.
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
 * is of type 'Feature Layer', and constructs a `Resource` object with relevant information.
 * If the resource is not a 'Feature Layer', an error is thrown.
 *
 * @param context - An object containing the `resourceId` of the ArcGIS resource to fetch metadata for.
 * @returns A promise that resolves to a `Resource` object containing metadata about the ArcGIS resource.
 * @throws Will throw an error if the resource type is not 'Feature Layer'.
 */
const getMetaData = async ({ resourceId }: GetResourceContext<ArcGISConfig>): Promise<Resource> => {
  debug(`fetching metadata of ${resourceId}`)

  const url = resourceId + '?f=json'
  const data: ArcGISLayer = (await axios.get(url)).data
  if (data.type !== 'Feature Layer') {
    console.error(`error : attempt to download a file from arcGIS with a ${data.type} type`)
    throw new Error(`Les ressources ArcGIS pouvant être importées doivent être de type 'Feature Layer' (type reçu : ${data.type})`)
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
    const url = resourceId + '/query?where=1%3D1&f=geojson'
    const response = (await axios.get(url))
    if (response.status !== 200) {
      throw new Error(`Erreur lors du téléchargement ${JSON.stringify(response)}`)
    }

    fs.writeFileSync(filePath, JSON.stringify(response.data))  // data format geoJSON

    return filePath
  } catch (error) {
    console.error('Error fetching data:', error)
    throw new Error('Error pendant le téléchargement du fichier')
  }
}
