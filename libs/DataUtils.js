// DataUtils.js required by RGBELoader

THREE.DataUtils = {

	toHalfFloat: function ( val ) {

		if ( Math.abs( val ) > 65504 ) console.warn( 'THREE.DataUtils.toHalfFloat(): Value out of range.' );

		// Use Math.min/max directly if MathUtils is not available
		val = Math.max( Math.min( val, 65504 ), -65504 );

		// Source: http://gamedev.stackexchange.com/questions/17326/conversion-of-a-number-from-single-precision-floating-point-representation-to-a/17410#17410

		const f32 = new Float32Array( 1 );
		const f16 = new Uint16Array( 1 );

		f32[ 0 ] = val;
		const x = f32[ 0 ];

		const sign = ( x >> 31 ) & 0x0001;
		const exponent = ( ( x >> 23 ) & 0x00ff ) - 127;
		const mantissa = x & 0x007fffff;

		if ( exponent === 128 ) {

			// Infinity or NaN (all exponent bits set)
			f16[ 0 ] = ( sign << 15 ) | ( 0x1f << 10 ) | ( mantissa ? 0x0200 : 0x0000 );

		} else if ( exponent > 15 ) {

			// Overflow - flush to Infinity
			f16[ 0 ] = ( sign << 15 ) | ( 0x1f << 10 ) | 0x0000;

		} else if ( exponent > - 15 ) {

			// Representable value
			f16[ 0 ] = ( sign << 15 ) | ( ( exponent + 15 ) << 10 ) | ( mantissa >> 13 );

		} else {

			// Underflow - flush to zero
			f16[ 0 ] = ( sign << 15 ) | 0x0000;

		}

		return f16[ 0 ];

	}

}; 