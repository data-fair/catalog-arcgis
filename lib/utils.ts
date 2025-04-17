import type { ArcGISResponse, ArcGISService } from '#types'

import memoize from 'memoize'
import axios from '@data-fair/lib-node/axios.js'

export const memoizedFetch = memoize(async (url: string) => {
  return (await axios.get(url, { params: { f: 'json' } })).data
}, {
  maxAge: 1000 * 60 * 5 // 5 minutes
})

export const listServices = async (baseUrl: string): Promise<ArcGISService[]> => {
  const rootData: ArcGISResponse = await memoizedFetch(baseUrl)
  const services = rootData.services ?? []

  for (const folder of rootData.folders || []) {
    const folderServices = await listServicesInFolder(baseUrl, folder)
    services.push(...folderServices)
  }

  return services
}

const listServicesInFolder = async (baseUrl: string, folder: string): Promise<ArcGISService[]> => {
  const folderUrl = baseUrl + folder
  const folderData: ArcGISResponse = await memoizedFetch(folderUrl)
  const services = folderData.services ?? []

  // Recursively list services in subfolders
  for (const subFolder of folderData.folders || []) {
    const subFolderServices = await listServicesInFolder(baseUrl, folder + '/' + subFolder)
    services.push(...subFolderServices)
  }

  return services
}
