import { getResource } from '../lib/download.ts'
import type { ArcGISConfig, ArcGISLayer } from '#types'
import type { GetResourceContext } from '@data-fair/types-catalogs'
import { before, after, describe, it } from 'node:test'
import nock from 'nock'
import assert, { fail } from 'node:assert'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'

describe('getResource', () => {
  const tmpDir = './test-it/tmp'

  before(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true })
    }
  })

  after(() => {
    if (existsSync(tmpDir)) {
      try {
        import('node:fs').then(fs => {
          fs.rmSync(tmpDir, { recursive: true, force: true })
        })
      } catch (err) { }
    }
  })

  describe('test with mock requests', async () => {
    const resourceId = 'https://example.com/arcgis2/rest/services/AppliGrandPublic/EQUIPEMENTS_PUBLICS/MapServer/1'
    const context: GetResourceContext<ArcGISConfig> = {
      resourceId,
      tmpDir,
      catalogConfig: {
        url: 'https://example.com/arcgis2/rest/services'
      },
      secrets: {},
      importConfig: {}
    }

    it('should fetch metadata and download resource successfully', async () => {
      // Mock the metadata response
      const metadataResponse: ArcGISLayer = {
        type: 'Feature Layer',
        name: 'Equipement',
        id: '1',
        description: 'Description of the resource'
      }

      // Mock the data response (geoJSON)
      const dataResponse = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0.34591862903985909, 46.588057736232244] }, properties: { NOMSITE: 'Onisep' } }]
      }

      nock('https://example.com')
        .get('/arcgis2/rest/services/AppliGrandPublic/EQUIPEMENTS_PUBLICS/MapServer/1?f=json')
        .reply(200, metadataResponse)

      nock('https://example.com')
        .get('/arcgis2/rest/services/AppliGrandPublic/EQUIPEMENTS_PUBLICS/MapServer/1/query?where=1%3D1&f=geojson&resultOffset=0&resultRecordCount=1000')
        .reply(200, dataResponse)

      const resource = await getResource(context)

      assert.ok(resource)
      assert.strictEqual(resource.id, resourceId)
      assert.strictEqual(resource.title, 'Equipement-1')
      assert.strictEqual(resource.format, 'geojson')
      assert.strictEqual(resource.origin, resourceId)
      assert.strictEqual(resource.description, 'Description of the resource')

      assert.strictEqual(resource.filePath, 'test-it/tmp/Equipement-1.geojson')
      assert.ok(existsSync(resource.filePath))
      const content = readFileSync(resource.filePath, 'utf-8')
      assert.strictEqual(content, JSON.stringify(dataResponse))
    })

    it('should throw an error if the resource type is not Feature Layer', async () => {
      // Mock the metadata response with a wrong type
      const metadataResponse = {
        type: 'Map Service',
        name: 'EQUIPEMENTS_PUBLICS',
        id: '1',
        description: 'Description of the resource'
      }

      // Use nock to intercept HTTP requests
      nock('https://example.com')
        .get('/arcgis2/rest/services/AppliGrandPublic/EQUIPEMENTS_PUBLICS/MapServer/1?f=json')
        .reply(200, metadataResponse)

      try {
        await getResource(context)
        fail('Expected an error to be thrown')
      } catch (error) {
        if (error instanceof Error) {
          assert.strictEqual(error.message, 'Les ressources ArcGIS pouvant être importées doivent être de type \'Feature Layer\' ou \'AnnotationLayer\' (type reçu : Map Service)')
        } else {
          fail('An unexpected error occurred')
        }
      }
    })
  })

  it('test the getResource method with a real url', async () => {
    const resourceId = 'https://sig.grandpoitiers.fr/arcgis2/rest/services/AppliGrandPublic/EQUIPEMENTS_PUBLICS/MapServer/1'
    const context: GetResourceContext<ArcGISConfig> = {
      resourceId,
      tmpDir,
      catalogConfig: {
        url: 'https://sig.grandpoitiers.fr/arcgis2/rest/services'
      },
      secrets: {},
      importConfig: {}
    }
    const resource = await getResource(context)

    assert.ok(resource)
    assert.strictEqual(resource.id, resourceId)
    assert.strictEqual(resource.title, 'Académique-1')
    assert.strictEqual(resource.format, 'geojson')
    assert.strictEqual(resource.origin, resourceId)
    assert.strictEqual(resource.description, '')

    assert.strictEqual(resource.filePath, 'test-it/tmp/Académique-1.geojson')
    assert.ok(existsSync(resource.filePath))
    const content = readFileSync(resource.filePath, 'utf-8')
    const exepect = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0.34591862903985909, 46.588057736232244] }, properties: { NOMSITE: 'Onisep' } }]
    }
    assert.strictEqual(content, JSON.stringify(exepect))
  })
})
