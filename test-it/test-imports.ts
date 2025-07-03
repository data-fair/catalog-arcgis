import type { ArcGISConfig, ArcGISService, ArcGISSubLayer } from '#types'
import { list } from '../lib/imports.ts'
import type { ArcGISCapabilities } from '../lib/capabilities.ts'
import type { ListContext } from '@data-fair/types-catalogs'
import { describe, it } from 'node:test'
import nock from 'nock'
import assert from 'node:assert'

describe('list', () => {
  const catalogConfig = {
    //   /!\ il faut le redéfinir a chaque test (a cause du memoize) à moins d'utiliser un current.resourceId différent à chaque test
    url: 'https://example.com/arcgis/rest/services'
  }

  const context: ListContext<ArcGISConfig, ArcGISCapabilities> = {
    catalogConfig,
    params: {
      currentFolderId: ''
    },
    secrets: {}
  }

  describe('tests with mock requests', async () => {
    it('should list folders, services successfully', async () => {
      const mockResponse: { folders: string[], services: ArcGISService[] } = {
        folders: ['folder1', 'folder2'],
        services: [
          { name: 'Service1', type: 'FeatureServer', url: 'https://example.com/arcgis/rest/services/Service1/FeatureServer' },
          { name: 'Service2', type: 'MapServer', url: 'https://example.com/arcgis/rest/services/Service2/MapServer' }
        ]
      }

      nock('https://example.com')
        .get('/arcgis/rest/services?f=json')
        .reply(200, mockResponse)

      const result = await list(context)

      assert.ok(result)
      assert.strictEqual(result.results.length, 4)
      assert.strictEqual(result.path.length, 0)
      assert.ok(result.results.some(folder => folder.title === 'folder1'))
      assert.ok(result.results.some(folder => folder.title === 'folder2'))
      assert.ok(result.results.some(folder => folder.title === 'Service1 (FeatureServer)'))
      assert.ok(result.results.some(folder => folder.title === 'Service2 (MapServer)'))
    })

    it('should handle subLayers and ignore unsupported types', async () => {
      context.params.currentFolderId = 'https://example.com/arcgis/rest/services/test-1/FeatureServer/1'
      const mockResponse: { subLayers: ArcGISSubLayer[], tables: Record<string, string>[] } = {
        subLayers: [
          { name: 'SubLayer1', id: '0' }
        ],
        tables: [
          { name: 'Table1', id: '0' }
        ]
      }

      nock('https://example.com')
        .get('/arcgis/rest/services/test-1/FeatureServer/1?f=json')
        .reply(200, mockResponse)

      const result = await list(context)
      assert.ok(result)
      assert.strictEqual(result.results.length, 1)
      assert.strictEqual(result.path.length, 2)
    })

    it('should handle currentFolderId when provided', async () => {
      const mockResponse: { folders: string[], services: ArcGISService[] } = {
        folders: ['subfolder1'],
        services: []
      }

      const contextWithFolder: ListContext<ArcGISConfig, ArcGISCapabilities> = {
        catalogConfig,
        params: {
          currentFolderId: 'https://example.com/arcgis/rest/services/folder1'
        },
        secrets: {}
      }

      nock('https://example.com')
        .get('/arcgis/rest/services/folder1?f=json')
        .reply(200, mockResponse)

      const result = await list(contextWithFolder)

      assert.ok(result)
      assert.strictEqual(result.results.length, 1)
      assert.strictEqual(result.path.length, 1)
    })
  })
})
