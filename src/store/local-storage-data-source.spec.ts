import { DataSource, DocumentObject, Model, persistent, Persistent, registerPersistentClass, Store } from 'entropic-bond'
import { TestUser } from '../mocks/test-user'
import { LocalStorageDataSource } from './local-storage-data-source'

@registerPersistentClass( 'TestCollection' )
class TestCollection extends Persistent {
	set prop( value: string ) {
		this._prop = value
	}

	get prop(): string {
		return this._prop
	}

	@persistent private _prop: string = this.id
}

@registerPersistentClass( 'TestCollection2' )
class TestCollection2 extends Persistent {}

describe( 'LocalStorage DataSource', ()=>{
	let datasource: LocalStorageDataSource

	beforeEach(()=>{
		localStorage.clear()
	})

	afterAll(()=>{
		localStorage.clear()
	})

	describe( 'Data persistence', ()=>{
		beforeEach(()=>{
			datasource = new LocalStorageDataSource()
			Store.useDataSource( datasource )
		})

		it( 'should save and find by id', async ()=>{
			await datasource.save({ TestCollection: [{ id: 'id1', value: 1 } as any ]})
			const doc = await datasource.findById( 'id1', 'TestCollection' )
			expect( doc ).toBeDefined()
			expect( doc.id ).toBe( 'id1' )
		})

		it( 'should persist data in localStorage', async ()=>{
			await datasource.save({ TestCollection: [{ id: 'id1' } as any ]})
			const raw = localStorage.getItem( 'TestCollection' )
			expect( raw ).toBeDefined()
			expect( JSON.parse( raw! ) ).toHaveProperty( 'id1' )
		})

		it( 'should update existing document', async ()=>{
			await datasource.save({ TestCollection: [{ id: 'id1', value: 1 } as any ]})
			await datasource.save({ TestCollection: [{ id: 'id1', value: 2 } as any ]})
			const doc = await datasource.findById( 'id1', 'TestCollection' ) as any
			expect( doc.value ).toBe( 2 )
		})

		it( 'should delete a document', async ()=>{
			await datasource.save({ TestCollection: [{ id: 'id1' } as any ]})
			await datasource.delete( 'id1', 'TestCollection' )
			const doc = await datasource.findById( 'id1', 'TestCollection' )
			expect( doc ).toBeUndefined()
		})

		it( 'should return undefined for non-existing document', async ()=>{
			const doc = await datasource.findById( 'nonexistent', 'TestCollection' )
			expect( doc ).toBeUndefined()
		})

		it( 'should load data from existing localStorage', async ()=>{
			localStorage.setItem( 'TestCollection', JSON.stringify({ existing: { id: 'existing', name: 'loaded' } }) )
			const doc = await datasource.findById( 'existing', 'TestCollection' ) as any
			expect( doc ).toBeDefined()
			expect( doc.name ).toBe( 'loaded' )
		})
	})

	describe( 'Find operations', ()=>{
		beforeEach(()=>{
			datasource = new LocalStorageDataSource({
				TestCollection: { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } } as any
			})
			Store.useDataSource( datasource )
		})

		it( 'should find all documents', async ()=>{
			const docs = await datasource.find( null as any, 'TestCollection' )
			expect( docs ).toHaveLength( 3 )
		})

		it( 'should find with limit', async ()=>{
			const docs = await datasource.find({ limit: 2 } as any, 'TestCollection' )
			expect( docs ).toHaveLength( 2 )
		})

		it( 'should support pagination with next', async ()=>{
			await datasource.find({ limit: 2 } as any, 'TestCollection' )
			const nextDocs = await datasource.next()
			expect( nextDocs ).toHaveLength( 1 )
		})

		it( 'should return empty array when no more results', async ()=>{
			await datasource.find({ limit: 3 } as any, 'TestCollection' )
			const nextDocs = await datasource.next()
			expect( nextDocs ).toHaveLength( 0 )
		})

		it( 'should count documents', async ()=>{
			const count = await datasource.count( null as any, 'TestCollection' )
			expect( count ).toBe( 3 )
		})
	})

	describe( 'Collection listeners', ()=>{
		let model: Model<TestCollection>

		beforeEach(()=>{
			datasource = new LocalStorageDataSource()
			Store.useDataSource( datasource )
			model = Store.getModel<TestCollection>( 'TestCollection' )
		})

		it( 'should install a listener', ()=>{
			const listener = vi.fn()
			const uninstall = model.onCollectionChange( model.find(), listener )

			model.save( new TestCollection( 'd' ))
			expect( listener ).toHaveBeenCalledWith([ expect.objectContaining({ after: expect.objectContaining({ id: 'd' }) }) ])
			uninstall()
		})

		it( 'should remove listener', ()=>{
			const listener = vi.fn()
			const uninstall = model.onCollectionChange( model.find(), listener )

			model.save( new TestCollection( 'd' ))
			expect( listener ).toHaveBeenCalledWith([ expect.objectContaining({ after: expect.objectContaining({ id: 'd' }) }) ])

			uninstall()
			listener.mockClear()

			model.save( new TestCollection('e'))
			expect( listener ).not.toHaveBeenCalled()
		})

		it( 'should install several listeners for the same collection', ()=>{
			const listener1 = vi.fn()
			const listener2 = vi.fn()
			const uninstall1 = model.onCollectionChange( model.find(), listener1 )
			const uninstall2 = model.onCollectionChange( model.find(), listener2 )

			model.save( new TestCollection( 'f' ))
			expect( listener1 ).toHaveBeenCalledWith([ expect.objectContaining({ after: expect.objectContaining({ id: 'f' }) }) ])
			expect( listener2 ).toHaveBeenCalledWith([ expect.objectContaining({ after: expect.objectContaining({ id: 'f' }) }) ])

			uninstall1()
			uninstall2()
		})

		it( 'should install several listeners for different collections', ()=>{
			const listener1 = vi.fn()
			const listener2 = vi.fn()
			const uninstall1 = model.onCollectionChange( model.find(), listener1 )
			const model2 = Store.getModel<TestCollection2>( 'TestCollection2' )
			const uninstall2 = model2.onCollectionChange( model2.find(), listener2 )

			model.save( new TestCollection( 'g' ))
			expect( listener1 ).toHaveBeenCalledWith([ expect.objectContaining({ after: expect.objectContaining({ id: 'g' }) }) ])
			expect( listener2 ).not.toHaveBeenCalled()

			listener1.mockClear()
			listener2.mockClear()

			model2.save( new TestCollection2( 'h' ))
			expect( listener1 ).not.toHaveBeenCalled()
			expect( listener2 ).toHaveBeenCalledWith([ expect.objectContaining({ after: expect.objectContaining({ id: 'h' }) }) ])

			uninstall1()
			uninstall2()
		})
	})

	describe( 'Document listeners', ()=>{
		let model: Model<TestCollection>

		beforeEach(()=>{
			datasource = new LocalStorageDataSource()
			Store.useDataSource( datasource )
			model = Store.getModel<TestCollection>( 'TestCollection' )
		})

		it( 'should install a listener', ()=>{
			const listener = vi.fn()
			const uninstall = model.onDocumentChange( 'a', listener )

			model.save( new TestCollection( 'a' ))
			expect( listener ).toHaveBeenCalledWith( expect.objectContaining({ after: expect.objectContaining({ id: 'a' }) }) )
			uninstall()
		})

		it( 'should remove listener', ()=>{
			const listener = vi.fn()
			const uninstall = model.onDocumentChange( 'b', listener )

			model.save( new TestCollection( 'b' ))
			expect( listener ).toHaveBeenCalledWith( expect.objectContaining({ after: expect.objectContaining({ id: 'b' }) }) )

			uninstall()
			listener.mockClear()

			model.save( new TestCollection('b'))
			expect( listener ).not.toHaveBeenCalled()
		})

		it( 'should install several listeners for the same document', ()=>{
			const listener1 = vi.fn()
			const listener2 = vi.fn()
			const uninstall1 = model.onDocumentChange( 'c', listener1 )
			const uninstall2 = model.onDocumentChange( 'c', listener2 )

			model.save( new TestCollection( 'c' ))
			expect( listener1 ).toHaveBeenCalledWith( expect.objectContaining({ after: expect.objectContaining({ id: 'c' }) }) )
			expect( listener2 ).toHaveBeenCalledWith( expect.objectContaining({ after: expect.objectContaining({ id: 'c' }) }) )

			uninstall1()
			uninstall2()
		})

		it( 'should install several listeners for different documents', ()=>{
			const listener1 = vi.fn()
			const listener2 = vi.fn()
			const uninstall1 = model.onDocumentChange( 'a', listener1 )
			const uninstall2 = model.onDocumentChange( 'b', listener2 )

			model.save( new TestCollection( 'a' ))
			expect( listener1 ).toHaveBeenCalledWith( expect.objectContaining({ after: expect.objectContaining({ id: 'a' }) }) )
			expect( listener2 ).not.toHaveBeenCalled()

			listener1.mockClear()
			listener2.mockClear()

			model.save( new TestCollection( 'b' ))
			expect( listener1 ).not.toHaveBeenCalled()
			expect( listener2 ).toHaveBeenCalledWith( expect.objectContaining({ after: expect.objectContaining({ id: 'b' }) }) )

			uninstall1()
			uninstall2()
		})
	})

	describe( 'Document template listeners', ()=>{
		beforeEach(()=>{
			datasource = new LocalStorageDataSource()
			Store.useDataSource( datasource )
		})

		it( 'should support collection templates with partial matches and notify all matched documents', ()=>{
			datasource.save({ 'Customer/1/Audit': [{ id: 'a', val: 1 } as any ]})
			datasource.save({ 'Customer/2/Audit': [{ id: 'a', val: 2 } as any ]})

			const listener = vi.fn()
			const uninstall = datasource.onDocumentTemplateChange( 'Customer/{customerId}/Audit', listener )

			datasource.save({ 'Customer/1/Audit': [{ id: 'a', val: 11 } as any ] })
			expect( listener ).toHaveBeenCalledWith( expect.objectContaining({
				after: expect.objectContaining({ id: 'a', val: 11 }),
				params: { customerId: '1' },
				collectionPath: 'Customer/1/Audit'
			}) )

			listener.mockClear()
			datasource.save({ 'Customer/2/Audit': [{ id: 'a', val: 22 } as any ] })
			expect( listener ).toHaveBeenCalledWith( expect.objectContaining({
				after: expect.objectContaining({ id: 'a', val: 22 }),
				params: { customerId: '2' },
				collectionPath: 'Customer/2/Audit'
			}) )

			uninstall()
		})

		it( 'should support collection templates and notify all matched documents', ()=>{
			datasource.save({ 'Customer/1/Audit': [{ id: 'a', val: 1 } as any ]})
			datasource.save({ 'Customer/2/Audit': [{ id: 'a', val: 2 } as any ]})

			const listener = vi.fn()
			const uninstall = datasource.onDocumentTemplateChange( '{rootCollection}/{customerId}/{subCollection}', listener )

			datasource.save({ 'Customer/1/Audit': [{ id: 'a', val: 11 } as any ] })
			expect( listener ).toHaveBeenCalledWith( expect.objectContaining({
				after: expect.objectContaining({ id: 'a', val: 11 }),
				params: { rootCollection: 'Customer', customerId: '1', subCollection: 'Audit' },
				collectionPath: 'Customer/1/Audit'
			}) )

			listener.mockClear()
			datasource.save({ 'Customer/2/Audit': [{ id: 'a', val: 22 } as any ] })
			expect( listener ).toHaveBeenCalledWith( expect.objectContaining({
				after: expect.objectContaining({ id: 'a', val: 22 }),
				params: { rootCollection: 'Customer', customerId: '2', subCollection: 'Audit' },
				collectionPath: 'Customer/2/Audit'
			}) )

			uninstall()
		})
	})

	describe( 'Query operations', ()=>{
		let model: Model<TestUser>

		beforeEach( async ()=>{
			datasource = new LocalStorageDataSource()
			Store.useDataSource( datasource )
			model = Store.getModel<TestUser>( 'TestUser' )

			const user1 = new TestUser('user1')
			user1.age = 23
			user1.admin = true
			user1.name = { firstName: 'Alice', lastName: 'Smith' }
			await model.save( user1 )

			const user2 = new TestUser('user2')
			user2.age = 21
			user2.admin = false
			user2.name = { firstName: 'Bob', lastName: 'Jones' }
			await model.save( user2 )

			const user3 = new TestUser('user3')
			user3.age = 56
			user3.admin = true
			user3.name = { firstName: 'Charlie', lastName: 'Brown' }
			await model.save( user3 )
		})

		it( 'should find with where clause', async ()=>{
			const admins = await model.find().where( 'admin', '==', true ).get()
			expect( admins ).toHaveLength( 2 )
		})

		it( 'should find with multiple where clauses', async ()=>{
			const admins = await model.find().where( 'admin', '==', true ).where( 'age', '<', 50 ).get()
			expect( admins ).toHaveLength( 1 )
			expect( admins[0]?.id ).toBe( 'user1' )
		})

		it( 'should find with OR query', async ()=>{
			const docs = await model.find().or( 'age', '==', 23 ).or( 'age', '==', 56 ).get()
			expect( docs ).toHaveLength( 2 )
		})

		it( 'should combine AND and OR', async ()=>{
			const docs = await model.find().where( 'admin', '==', true ).or( 'age', '==', 21 ).get()
			expect( docs ).toHaveLength( 3 )
		})

		it( 'should find with comparison operators', async ()=>{
			const docs = await model.find().where( 'age', '>', 30 ).get()
			expect( docs ).toHaveLength( 1 )
			expect( docs[0]?.id ).toBe( 'user3' )
		})

		it( 'should sort ascending', async ()=>{
			const docs = await model.find().orderBy( 'age' ).get()
			expect( docs[0]?.id ).toBe( 'user2' )
			expect( docs[1]?.id ).toBe( 'user1' )
			expect( docs[2]?.id ).toBe( 'user3' )
		})

		it( 'should sort descending', async ()=>{
			const docs = await model.find().orderBy( 'age', 'desc' ).get()
			expect( docs[0]?.id ).toBe( 'user3' )
			expect( docs[1]?.id ).toBe( 'user1' )
			expect( docs[2]?.id ).toBe( 'user2' )
		})

		it( 'should limit results', async ()=>{
			const docs = await model.find().limit( 2 ).get()
			expect( docs ).toHaveLength( 2 )
		})

		it( 'should find by subproperty', async ()=>{
			const docs = await model.find().where( 'name', '==', { firstName: 'Alice' }).get()
			expect( docs ).toHaveLength( 1 )
			expect( docs[0]?.id ).toBe( 'user1' )
		})

		it( 'should count results', async ()=>{
			const count = await model.find().count()
			expect( count ).toBe( 3 )
		})
	})

	describe( 'Data cursors', ()=>{
		let model: Model<TestUser>

		beforeEach( async ()=>{
			datasource = new LocalStorageDataSource()
			Store.useDataSource( datasource )
			model = Store.getModel<TestUser>( 'TestUser' )

			for ( let i = 1; i <= 6; i++ ) {
				await model.save( new TestUser( `user${ i }` ) )
			}
		})

		it( 'should get next result set', async ()=>{
			await model.find().get( 2 )
			const docs = await model.next()
			expect( docs ).toHaveLength( 2 )
		})

		it( 'should not go beyond the end of result set', async ()=>{
			await model.find().get( 2 )
			await model.next()
			await model.next()
			const docs = await model.next()
			expect( docs ).toHaveLength( 0 )
		})
	})

	describe( 'Helper methods', ()=>{
		describe( 'isStringMatchingTemplate', ()=>{
			it( 'should match simple templates', ()=>{
				expect( DataSource.isStringMatchingTemplate( 'Customer/{customerId}/Audit', 'Customer/2/Audit' )).toBe( true )
				expect( DataSource.isStringMatchingTemplate( 'Customer/{customerId}/Audit', 'Customer/faad-dfaa-00f0/Audit' )).toBe( true )
				expect( DataSource.isStringMatchingTemplate( 'Customer/{customerId}/Audit', 'Customer/2/Au' )).toBe( false )
				expect( DataSource.isStringMatchingTemplate( 'Customer/{customerId}/Audit', 'Cus/2/Audit' )).toBe( false )
				expect( DataSource.isStringMatchingTemplate( 'Customer/{customerId}/Audit', 'Customer/Audit' )).toBe( false )
				expect( DataSource.isStringMatchingTemplate( 'Customer/{customerId}/Audit', 'Customer' )).toBe( false )
				expect( DataSource.isStringMatchingTemplate( 'Customer/{customerId}/Audit', 'Audit' )).toBe( false )
				expect( DataSource.isStringMatchingTemplate( '{rootCollection}/{customerId}/{subCollection}', 'Audit' )).toBe( true )
			})
		})

		describe( 'extractTemplateParams', ()=>{
			it( 'should extract params from simple templates', ()=>{
				expect( DataSource.extractTemplateParams( 'Customer/2/Audit', 'Customer/{customerId}/Audit' )).toEqual( { customerId: '2' } )
				expect( DataSource.extractTemplateParams( 'Customer/faad-dfaa-00f0/Audit', 'Customer/{customerId}/Audit' )).toEqual( { customerId: 'faad-dfaa-00f0' } )
				expect( DataSource.extractTemplateParams( 'Customer/2/Order/5', 'Customer/{customerId}/Order/{orderId}' )).toEqual( { customerId: '2', orderId: '5' } )
				expect( DataSource.extractTemplateParams( 'Audit', '{rootCollection}/{customerId}/{subCollection}' )).toEqual( { rootCollection: 'Audit' } )
				expect( DataSource.extractTemplateParams( 'Customer/2/Audit', '{rootCollection}/{customerId}/{subCollection}' )).toEqual( { rootCollection: 'Customer', customerId: '2', subCollection: 'Audit' } )
			})
		})
	})
})
