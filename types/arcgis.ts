export interface ArcGISService {
  name: string
  type: string
}

export interface ArcGISResponse {
  currentVersion: number
  folders?: string[]
  services?: ArcGISService[]
}

export interface MapServerLayer {
  id: number
  name: string
  parentLayerId: number
  defaultVisibility: boolean
  subLayerIds: number[] | null
  minScale: number
  maxScale: number
  type: 'Group Layer' | 'Feature Layer'
}

export interface MapServerResponse {
  currentVersion: number
  serviceDescription: string
  mapName: string
  description: string
  copyrightText: string
  supportsDynamicLayers: boolean
  layers: MapServerLayer[]
}
