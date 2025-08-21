import type { PrepareContext } from '@data-fair/types-catalogs'
import type { ArcGISCapabilities } from './capabilities.ts'
import type { ArcGISConfig } from '#types'
import axios from '@data-fair/lib-node/axios.js'

/**
 * Prepares the ArcGIS catalog by validating the configuration and testing the API connection.
 */
export default async ({ catalogConfig, secrets }: PrepareContext<ArcGISConfig, ArcGISCapabilities>) => {
  try {
    // Test the URL
    const res = await axios.get(catalogConfig.url, { params: { f: 'json' } })
    if (res.status !== 200) {
      throw new Error('Failed to fetch ArcGIS catalog')
    }
  } catch (error) {
    console.error('Error testing ArcGIS URL:', error)
    throw new Error('Invalid ArcGIS URL')
  }

  return {
    catalogConfig,
    secrets
  }
}
