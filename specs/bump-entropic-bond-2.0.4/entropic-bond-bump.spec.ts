import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const projectRoot = process.cwd()
const manifest = JSON.parse( readFileSync( join( projectRoot, 'package.json' ), 'utf8' ) )
const lockfile = JSON.parse( readFileSync( join( projectRoot, 'package-lock.json' ), 'utf8' ) )

describe( 'entropic-bond dependency pinning', () => {
	it( 'declares the entropic-bond range ^2.0.4 in the package manifest', () => {
		expect( manifest.devDependencies['entropic-bond'] ).toBe( '^2.0.4' )
	} )

	it( 'declares the entropic-bond range ^2.0.4 in the lockfile root dependencies', () => {
		expect( lockfile.packages['']?.devDependencies?.['entropic-bond'] ).toBe( '^2.0.4' )
	} )

	it( 'resolves entropic-bond to exactly 2.0.4 in the lockfile', () => {
		expect( lockfile.packages['node_modules/entropic-bond']?.version ).toBe( '2.0.4' )
	} )
} )
