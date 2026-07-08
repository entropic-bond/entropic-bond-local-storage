import { Unsubscriber } from 'entropic-bond'
import { Collections, DocumentChange, DocumentChangeType, Persistent, PersistentObject } from 'entropic-bond'
import { Collection } from 'entropic-bond'
import { CollectionChangeListener, DataSource, DocumentChangeListener, DocumentObject, QueryObject, QueryOperation, QueryOrder } from 'entropic-bond'

interface LocalStorageRawData {
	[ collection: string ]: {
		[ documentId: string ]: PersistentObject<Persistent>
	}
}

type QueryProcessors = {
	[ P in keyof Required<QueryObject<unknown>> ]: Function
}

export class LocalStorageDataSource extends DataSource {

	constructor( initialData?: LocalStorageRawData ) {
		super()
		if ( initialData ) {
			Object.entries( initialData ).forEach(([ collectionName, documents ]) => {
				localStorage.setItem( collectionName, JSON.stringify( documents ) )
			})
		}
	}

	private getCollectionData<T = DocumentObject>( collectionName: string ): Record<string, T> {
		const raw = localStorage.getItem( collectionName )
		return raw ? JSON.parse( raw ) : {}
	}

	private setCollectionData( collectionName: string, data: Record<string, DocumentObject> ): void {
		localStorage.setItem( collectionName, JSON.stringify( data ) )
	}

	private getAllCollectionNames(): string[] {
		return Object.keys( localStorage )
	}

	findById( id: string, collectionName: string ): Promise<DocumentObject> {
		const data = this.getCollectionData( collectionName )
		return Promise.resolve( data[ id ] as DocumentObject )
	}

	find( queryObject: QueryObject<DocumentObject>, collectionName: string ): Promise<DocumentObject[]> {
		const rawData = this.getCollectionData( collectionName )
		const rawDataArray = Object.values( rawData )
		if ( !queryObject ) return Promise.resolve( rawDataArray )

		this._lastLimit = queryObject.limit || 0
		this._cursor = 0

		this._lastMatchingDocs = Object.entries( queryObject ).reduce(
			( prevDocs, [ processMethod, value ]) => {
				return this.queryProcessor( prevDocs, processMethod as any, value )
			}, Object.values( rawDataArray )
		)

		return Promise.resolve( this._lastMatchingDocs.slice( 0, queryObject.limit ) )
	}

	save( collections: Collections ): Promise<void> {
		Object.entries( collections ).forEach(([ collectionName, collection ]) => {
			const data = this.getCollectionData( collectionName )
			collection?.forEach( document => {
				const oldValue = data[ document.id ]
				data[ document.id ] = document
				this.setCollectionData( collectionName, data )
				this.notifyChange( collectionName, document, oldValue )
			})
		})

		return Promise.resolve()
	}

	delete( id: string, collectionName: string ): Promise<void> {
		const data = this.getCollectionData( collectionName )
		delete data[ id ]
		this.setCollectionData( collectionName, data )
		return Promise.resolve()
	}

	next( limit?: number ): Promise<DocumentObject[]> {
		if ( limit ) this._lastLimit = limit
		this.incCursor( this._lastLimit )

		return Promise.resolve( this._lastMatchingDocs.slice( this._cursor, this._cursor + this._lastLimit ) )
	}

	count( queryObject: QueryObject<DocumentObject>, collectionName: string ): Promise<number> {
		return Promise.resolve(
			Object.keys( this.getCollectionData( collectionName ) ?? {} ).length
		)
	}

	override onCollectionChange( query: QueryObject<DocumentObject>, collectionName: string, listener: CollectionChangeListener<DocumentObject> ): Unsubscriber {
		let listeners = this._collectionListeners[ collectionName ]
		if ( !listeners ) {
			this._collectionListeners[ collectionName ] = {}
			listeners = this._collectionListeners[ collectionName ]
		}
		const finalListener = ( change: DocumentChange<DocumentObject> ) => {
			if ( !change.after ) return
			const testDocs = [ change.after ]
			if ( change.before ) testDocs.push( change.before )
			const docs = this.retrieveQueryDocs(testDocs, query.operations!)
			const uniqueDocs = docs.filter((doc, index, self) => index === self.findIndex(d => d.id === doc.id))
			if ( uniqueDocs.length > 0 ) listener( uniqueDocs.map( doc => ({
				before: change.before,
				after: doc,
				type: change.type,
				params: change.params,
			} as DocumentChange<DocumentObject> )) )
		}
		const uid = Math.random().toString( 36 ).substring( 2, 9 )
		listeners[ uid ] = finalListener
		return ()=> delete listeners[ uid ]
	}

	override onDocumentChange( collectionName: string, documentId: string, listener: DocumentChangeListener<DocumentObject> ): Unsubscriber {
		let listeners = this._documentListeners[ collectionName ]
		if ( !listeners ) {
			this._documentListeners[ collectionName ] = {}
			listeners = this._documentListeners[ collectionName ]
		}
		const finalListener = ( change: DocumentChange<DocumentObject> ) => {
			if ( change.after && change.after.id === documentId ) listener( change )
		}

		const uid = Math.random().toString( 36 ).substring( 2, 9 )
		listeners[ uid ] = finalListener
		return ()=> delete listeners[ uid ]
	}

	override onDocumentTemplateChange( collectionTemplate: string, listener: DocumentChangeListener<DocumentObject> ): Unsubscriber {
		const allCollections = this.collectionsMatchingTemplate( collectionTemplate )
		const unsubscribers: Unsubscriber[] = []

		allCollections.forEach( collectionName => {
			let listeners = this._documentListeners[ collectionName ]
			if ( !listeners ) {
				this._documentListeners[ collectionName ] = {}
				listeners = this._documentListeners[ collectionName ]
			}
			const finalListener = ( change: DocumentChange<DocumentObject> ) => {
				change.params = DataSource.extractTemplateParams( collectionName, collectionTemplate )
				listener( change )
			}

			const uid = Math.random().toString( 36 ).substring( 2, 9 )
			listeners[ uid ] = finalListener
			unsubscribers.push( () => delete listeners![ uid ] )
		})

		return () => unsubscribers.forEach( unsubscriber => unsubscriber() )
	}

	protected resolveCollectionPaths( template: string ): Promise<string[]> {
		return Promise.resolve( this.collectionsMatchingTemplate( template ) )
	}

	private collectionsMatchingTemplate( template: string ): string[] {
		return this.getAllCollectionNames().filter( collectionName => DataSource.isStringMatchingTemplate( template, collectionName ) )
	}

	private incCursor( amount: number ) {
		this._cursor += amount
		if ( this._cursor > this._lastMatchingDocs.length ) {
			this._cursor = this._lastMatchingDocs.length
		}
	}

	private decCursor( amount: number ) {
		this._cursor -= amount
		if ( this._cursor < 0 ) {
			this._cursor = 0
			return true
		}
		return false
	}

	private notifyChange( collectionPath: string, document: DocumentObject, oldValue: DocumentObject | undefined ) {
		const event: DocumentChange<DocumentObject> = {
			before: oldValue,
			after: document,
			collectionPath,
			params: {},
			type: (oldValue ? 'update' : 'create') as DocumentChangeType
		}

		Object.values( this._documentListeners[ collectionPath ] ?? {} ).forEach( listener => listener( event ) )
		Object.values( this._collectionListeners[ collectionPath ] ?? {} ).forEach( listener => listener( event ) )
	}

	private queryProcessor<T, P extends keyof QueryProcessors>( docs: DocumentObject[], processMethod: P, value: QueryObject<T>[P] ) {
		const processors: QueryProcessors = {
			limit: ( limit: number ) => docs,

			operations: ( operations: QueryOperation<T>[] ) => this.retrieveQueryDocs( docs, operations ),

			sort: ({ order, propertyName }:{ order: QueryOrder, propertyName: string }) => docs.sort( ( a, b ) => {
				const aVal = this.deepValue( a, propertyName )
				const bVal = this.deepValue( b, propertyName )
				if ( order === 'asc' ) {
					return aVal > bVal ? 1 : -1
				}
				else {
					return aVal < bVal ? 1 : -1
				}
			})
		}

		return processors[ processMethod ]( value )
	}

	private retrieveQueryDocs<T>( docs: DocumentObject[], queryOperations: QueryOperation<T>[] ): DocumentObject[] {
		return queryOperations.reduce(( prevDocs, queryOperation, i ) => {
			if ( queryOperation.aggregate ) {
				const aggregate = docs.filter( doc => this.isQueryMatched( doc, queryOperation ) )
				if ( i === 0 ) return aggregate
				else return prevDocs.concat( aggregate )
			}
			else {
				return prevDocs.filter( doc => this.isQueryMatched( doc, queryOperation ) )
			}
		}, docs )
	}

	private deepValue( obj: DocumentObject, propertyPath: string ) {
		const propChain = propertyPath.split( '.' )
		return propChain.reduce(( value: any, prop ) => value[ prop ], obj )
	}

	private isQueryMatched<T>( doc: DocumentObject, queryOperation: QueryOperation<T> ) {
		const queryOperator = {
			'==': <U>(a: U, b: U) => a === b,
			'!=': <U>(a: U, b: U) => a !== b,
			'<': <U>(a: U, b: U) => a < b,
			'<=': <U>(a: U, b: U) => a <= b,
			'>': <U>(a: U, b: U) => a > b,
			'>=': <U>(a: U, b: U) => a >= b,
			'containsAny': <U>(a: U[], b: U[]) => a?.some( v => b?.includes( v ) ),
			'contains': <U>(a: U[], b: U) => a?.includes( b ),
		}

		const { property, value, operator } = queryOperation
		const [ propValue, v ] = this.retrieveValuesToCompare( doc, property as string, value )

		return queryOperator[ operator ]( propValue, v )
	}

	private retrieveValuesToCompare( doc: DocumentObject, propertyName: string, value: unknown ): [ any, any ] {
		const propertyValue = (doc as any)[ propertyName ]

		if ( propertyValue && typeof value === 'object' && !Array.isArray( value )) {
			const propName = Object.keys( value! )[0]!
			var [ propVal, val ] = this.retrieveValuesToCompare( propertyValue, propName, (value as any)?.[ propName ] )
		}

		return [ propVal || propertyValue, val || value ]
	}

	private _lastMatchingDocs: DocumentObject[] = []
	private _lastLimit: number = 0
	private _cursor: number = 0
	private _documentListeners: Collection<Collection<DocumentChangeListener<DocumentObject>>> = {}
	private _collectionListeners: Collection<Collection<DocumentChangeListener<DocumentObject>>> = {}
}
