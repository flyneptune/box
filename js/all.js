/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finter swipe

THREE.OrbitControls = function ( object, domElement ) {

	this.object = object;

	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// Set to false to disable this control
	this.enabled = true;

	// "target" sets the location of focus, where the object orbits around
	this.target = new THREE.Vector3();

	// How far you can dolly in and out ( PerspectiveCamera only )
	this.minDistance = 150;
	this.maxDistance = 1000;
	//this.minDistance = 0;
	//this.maxDistance = Infinity;

	// How far you can zoom in and out ( OrthographicCamera only )
	this.minZoom = 0;
	this.maxZoom = Infinity;


	//this.camBounds = 5;
	// How far you can orbit vertically, upper and lower limits.
	// Range is 0 to Math.PI radians.
	
	/*
	this.minPolarAngle = Math.PI/180*this.camBounds; // radians
	this.maxPolarAngle = Math.PI/2 - (Math.PI/180*this.camBounds); // radians
	*/
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI/2 - (Math.PI/180*10); // radians
	
	
	// How far you can orbit horizontally, upper and lower limits.
	// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
	/*
	this.minAzimuthAngle = -Math.PI/2 + (Math.PI/180*this.camBounds);
	this.maxAzimuthAngle = Math.PI/2 - (Math.PI/180*this.camBounds);
	*/
	this.minAzimuthAngle = - Infinity; // radians
	this.maxAzimuthAngle = Infinity; // radians
	

	// Set to true to enable damping (inertia)
	// If damping is enabled, you must call controls.update() in your animation loop
	this.enableDamping = false;
	this.dampingFactor = 0.25;

	// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
	// Set to false to disable zooming
	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	// Set to false to disable rotating
	this.enableRotate = true;
	this.rotateSpeed = 0.4;

	// Set to false to disable panning
	this.enablePan = false;
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// Set to true to automatically rotate around the target
	// If auto-rotate is enabled, you must call controls.update() in your animation loop
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	// Set to false to disable use of the keys
	this.enableKeys = true;

	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Mouse buttons
	this.mouseButtons = { ORBIT: THREE.MOUSE.LEFT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.RIGHT };

	// for reset
	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.zoom0 = this.object.zoom;

	//
	// public methods
	//

	this.getPolarAngle = function () {

		return spherical.phi;

	};

	this.getAzimuthalAngle = function () {

		return spherical.theta;

	};

	this.reset = function () {

		scope.target.copy( scope.target0 );
		scope.object.position.copy( scope.position0 );
		scope.object.zoom = scope.zoom0;

		scope.object.updateProjectionMatrix();
		scope.dispatchEvent( changeEvent );

		scope.update();

		state = STATE.NONE;

	};

	// this method is exposed, but perhaps it would be better if we can make it private...
	this.update = function() {

		var offset = new THREE.Vector3();

		// so camera.up is the orbit axis
		var quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
		var quatInverse = quat.clone().inverse();

		var lastPosition = new THREE.Vector3();
		var lastQuaternion = new THREE.Quaternion();

		return function update () {

			var position = scope.object.position;

			offset.copy( position ).sub( scope.target );

			// rotate offset to "y-axis-is-up" space
			offset.applyQuaternion( quat );

			// angle from z-axis around y-axis
			spherical.setFromVector3( offset );

			if ( scope.autoRotate && state === STATE.NONE ) {

				rotateLeft( getAutoRotationAngle() );

			}

			spherical.theta += sphericalDelta.theta;
			spherical.phi += sphericalDelta.phi;

			// restrict theta to be between desired limits
			spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );

			// restrict phi to be between desired limits
			spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

			spherical.makeSafe();


			spherical.radius *= scale;

			// restrict radius to be between desired limits
			spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

			// move target to panned location
			scope.target.add( panOffset );

			offset.setFromSpherical( spherical );

			// rotate offset back to "camera-up-vector-is-up" space
			offset.applyQuaternion( quatInverse );

			position.copy( scope.target ).add( offset );

			scope.object.lookAt( scope.target );

			if ( scope.enableDamping === true ) {

				sphericalDelta.theta *= ( 1 - scope.dampingFactor );
				sphericalDelta.phi *= ( 1 - scope.dampingFactor );

			} else {

				sphericalDelta.set( 0, 0, 0 );

			}

			scale = 1;
			panOffset.set( 0, 0, 0 );

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				lastPosition.distanceToSquared( scope.object.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

				scope.dispatchEvent( changeEvent );

				lastPosition.copy( scope.object.position );
				lastQuaternion.copy( scope.object.quaternion );
				zoomChanged = false;

				return true;

			}

			return false;

		};

	}();

	this.dispose = function() {

		scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
		scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
		scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );

		scope.domElement.removeEventListener( 'touchstart', onTouchStart, false );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd, false );
		scope.domElement.removeEventListener( 'touchmove', onTouchMove, false );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		window.removeEventListener( 'keydown', onKeyDown, false );

		//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

	};

	//
	// internals
	//

	var scope = this;

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var STATE = { NONE : - 1, ROTATE : 0, DOLLY : 1, PAN : 2, TOUCH_ROTATE : 3, TOUCH_DOLLY : 4, TOUCH_PAN : 5 };

	var state = STATE.NONE;

	var EPS = 0.000001;

	// current position in spherical coordinates
	var spherical = new THREE.Spherical();
	var sphericalDelta = new THREE.Spherical();

	var scale = 1;
	var panOffset = new THREE.Vector3();
	var zoomChanged = false;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	function getAutoRotationAngle() {

		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

	}

	function getZoomScale() {

		return Math.pow( 0.95, scope.zoomSpeed );

	}

	function rotateLeft( angle ) {

		sphericalDelta.theta -= angle;

	}

	function rotateUp( angle ) {

		sphericalDelta.phi -= angle;

	}

	var panLeft = function() {

		var v = new THREE.Vector3();

		return function panLeft( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			v.multiplyScalar( - distance );

			panOffset.add( v );

		};

	}();

	var panUp = function() {

		var v = new THREE.Vector3();

		return function panUp( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 1 ); // get Y column of objectMatrix
			v.multiplyScalar( distance );

			panOffset.add( v );

		};

	}();

	// deltaX and deltaY are in pixels; right and down are positive
	var pan = function() {

		var offset = new THREE.Vector3();

		return function pan ( deltaX, deltaY ) {

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			if ( scope.object instanceof THREE.PerspectiveCamera ) {

				// perspective
				var position = scope.object.position;
				offset.copy( position ).sub( scope.target );
				var targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

				// we actually don't use screenWidth, since perspective camera is fixed to screen height
				panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
				panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

			} else if ( scope.object instanceof THREE.OrthographicCamera ) {

				// orthographic
				panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
				panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				scope.enablePan = false;

			}

		};

	}();

	function dollyIn( dollyScale ) {

		if ( scope.object instanceof THREE.PerspectiveCamera ) {

			scale /= dollyScale;

		} else if ( scope.object instanceof THREE.OrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	function dollyOut( dollyScale ) {

		if ( scope.object instanceof THREE.PerspectiveCamera ) {

			scale *= dollyScale;

		} else if ( scope.object instanceof THREE.OrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	//
	// event callbacks - update the object state
	//

	function handleMouseDownRotate( event ) {

		//console.log( 'handleMouseDownRotate' );

		rotateStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownDolly( event ) {

		//console.log( 'handleMouseDownDolly' );

		dollyStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownPan( event ) {

		//console.log( 'handleMouseDownPan' );

		panStart.set( event.clientX, event.clientY );

	}

	function handleMouseMoveRotate( event ) {

		//console.log( 'handleMouseMoveRotate' );

		rotateEnd.set( event.clientX, event.clientY );
		rotateDelta.subVectors( rotateEnd, rotateStart );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		// rotating across whole screen goes 360 degrees around
		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );

		// rotating up and down along whole screen attempts to go 360, but limited to 180
		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleMouseMoveDolly( event ) {

		//console.log( 'handleMouseMoveDolly' );

		dollyEnd.set( event.clientX, event.clientY );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyIn( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyOut( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	function handleMouseMovePan( event ) {

		//console.log( 'handleMouseMovePan' );

		panEnd.set( event.clientX, event.clientY );

		panDelta.subVectors( panEnd, panStart );

		pan( panDelta.x, panDelta.y );

		panStart.copy( panEnd );

		scope.update();

	}

	function handleMouseUp( event ) {

		//console.log( 'handleMouseUp' );

	}

	function handleMouseWheel( event ) {

		//console.log( 'handleMouseWheel' );

		if ( event.deltaY < 0 ) {

			dollyOut( getZoomScale() );

		} else if ( event.deltaY > 0 ) {

			dollyIn( getZoomScale() );

		}

		scope.update();

	}

	function handleKeyDown( event ) {

		//console.log( 'handleKeyDown' );

		switch ( event.keyCode ) {

			case scope.keys.UP:
				pan( 0, scope.keyPanSpeed );
				scope.update();
				break;

			case scope.keys.BOTTOM:
				pan( 0, - scope.keyPanSpeed );
				scope.update();
				break;

			case scope.keys.LEFT:
				pan( scope.keyPanSpeed, 0 );
				scope.update();
				break;

			case scope.keys.RIGHT:
				pan( - scope.keyPanSpeed, 0 );
				scope.update();
				break;

		}

	}

	function handleTouchStartRotate( event ) {

		//console.log( 'handleTouchStartRotate' );

		rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

	}

	function handleTouchStartDolly( event ) {

		//console.log( 'handleTouchStartDolly' );

		var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

		var distance = Math.sqrt( dx * dx + dy * dy );

		dollyStart.set( 0, distance );

	}

	function handleTouchStartPan( event ) {

		//console.log( 'handleTouchStartPan' );

		panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

	}

	function handleTouchMoveRotate( event ) {

		//console.log( 'handleTouchMoveRotate' );

		rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
		rotateDelta.subVectors( rotateEnd, rotateStart );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		// rotating across whole screen goes 360 degrees around
		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );

		// rotating up and down along whole screen attempts to go 360, but limited to 180
		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleTouchMoveDolly( event ) {

		//console.log( 'handleTouchMoveDolly' );

		var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

		var distance = Math.sqrt( dx * dx + dy * dy );

		dollyEnd.set( 0, distance );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyOut( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyIn( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	function handleTouchMovePan( event ) {

		//console.log( 'handleTouchMovePan' );

		panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		panDelta.subVectors( panEnd, panStart );

		pan( panDelta.x, panDelta.y );

		panStart.copy( panEnd );

		scope.update();

	}

	function handleTouchEnd( event ) {

		//console.log( 'handleTouchEnd' );

	}

	//
	// event handlers - FSM: listen for events and reset state
	//

	function onMouseDown( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		if ( event.button === scope.mouseButtons.ORBIT ) {

			if ( scope.enableRotate === false ) return;

			handleMouseDownRotate( event );

			state = STATE.ROTATE;

		} else if ( event.button === scope.mouseButtons.ZOOM ) {

			if ( scope.enableZoom === false ) return;

			handleMouseDownDolly( event );

			state = STATE.DOLLY;

		} else if ( event.button === scope.mouseButtons.PAN ) {

			if ( scope.enablePan === false ) return;

			handleMouseDownPan( event );

			state = STATE.PAN;

		}

		if ( state !== STATE.NONE ) {

			document.addEventListener( 'mousemove', onMouseMove, false );
			document.addEventListener( 'mouseup', onMouseUp, false );

			scope.dispatchEvent( startEvent );

		}

	}

	function onMouseMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		if ( state === STATE.ROTATE ) {

			if ( scope.enableRotate === false ) return;

			handleMouseMoveRotate( event );

		} else if ( state === STATE.DOLLY ) {

			if ( scope.enableZoom === false ) return;

			handleMouseMoveDolly( event );

		} else if ( state === STATE.PAN ) {

			if ( scope.enablePan === false ) return;

			handleMouseMovePan( event );

		}

	}

	function onMouseUp( event ) {

		if ( scope.enabled === false ) return;

		handleMouseUp( event );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onMouseWheel( event ) {

		if ( scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE ) ) return;

		event.preventDefault();
		event.stopPropagation();

		handleMouseWheel( event );

		scope.dispatchEvent( startEvent ); // not sure why these are here...
		scope.dispatchEvent( endEvent );

	}

	function onKeyDown( event ) {

		if ( scope.enabled === false || scope.enableKeys === false || scope.enablePan === false ) return;

		handleKeyDown( event );

	}

	function onTouchStart( event ) {

		if ( scope.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:	// one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;

				handleTouchStartRotate( event );

				state = STATE.TOUCH_ROTATE;

				break;

			case 2:	// two-fingered touch: dolly

				if ( scope.enableZoom === false ) return;

				handleTouchStartDolly( event );

				state = STATE.TOUCH_DOLLY;

				break;

			case 3: // three-fingered touch: pan

				if ( scope.enablePan === false ) return;

				handleTouchStartPan( event );

				state = STATE.TOUCH_PAN;

				break;

			default:

				state = STATE.NONE;

		}

		if ( state !== STATE.NONE ) {

			scope.dispatchEvent( startEvent );

		}

	}

	function onTouchMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1: // one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;
				if ( state !== STATE.TOUCH_ROTATE ) return; // is this needed?...

				handleTouchMoveRotate( event );

				break;

			case 2: // two-fingered touch: dolly

				if ( scope.enableZoom === false ) return;
				if ( state !== STATE.TOUCH_DOLLY ) return; // is this needed?...

				handleTouchMoveDolly( event );

				break;

			case 3: // three-fingered touch: pan

				if ( scope.enablePan === false ) return;
				if ( state !== STATE.TOUCH_PAN ) return; // is this needed?...

				handleTouchMovePan( event );

				break;

			default:

				state = STATE.NONE;

		}

	}

	function onTouchEnd( event ) {

		if ( scope.enabled === false ) return;

		handleTouchEnd( event );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onContextMenu( event ) {

		event.preventDefault();

	}

	//

	scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

	scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
	scope.domElement.addEventListener( 'wheel', onMouseWheel, false );

	scope.domElement.addEventListener( 'touchstart', onTouchStart, false );
	scope.domElement.addEventListener( 'touchend', onTouchEnd, false );
	scope.domElement.addEventListener( 'touchmove', onTouchMove, false );

	window.addEventListener( 'keydown', onKeyDown, false );

	// force an update at start

	this.update();

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

Object.defineProperties( THREE.OrbitControls.prototype, {

	center: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .center has been renamed to .target' );
			return this.target;

		}

	},

	// backward compatibility

	noZoom: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			return ! this.enableZoom;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			this.enableZoom = ! value;

		}

	},

	noRotate: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			return ! this.enableRotate;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			this.enableRotate = ! value;

		}

	},

	noPan: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			return ! this.enablePan;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			this.enablePan = ! value;

		}

	},

	noKeys: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			return ! this.enableKeys;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			this.enableKeys = ! value;

		}

	},

	staticMoving : {

		get: function () {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			return ! this.enableDamping;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			this.enableDamping = ! value;

		}

	},

	dynamicDampingFactor : {

		get: function () {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			return this.dampingFactor;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			this.dampingFactor = value;

		}

	}

} );








//##################################################################################################
// renderer etc.
"use strict";

var scene;
var cont;//main container for objs in scene
var camera;
var light;
var renderer;
var canvas; //will be added to the body of the page.
var controls;  // an object of type TrackballControls, the handles roatation using the mouse.
var cameraAndLight;  // Object holding both camera and light.  The light shines from the direction of the camera.
var clock;  // Keeps track of elapsed time of animation.
var stats; //fps counter
//##################################################################################################



//##################################################################################################
//LOADING MANAGER
var assetsLoaded = false;
//##################################################################################################




//##################################################################################################
//spawnWorld.js
var loader = new THREE.JSONLoader();
//##################################################################################################


//##################################################################################################
//envMap cubeCam settings:
var cubeCamNear = 1;
var cubeCamFar = 2100;
var cubeCamRes = 512;

var updateCubeCams = true;
var arCubeCameras = [];// [model, cam], [model, cam], ...
//############################################################################



//##################################################################################################
//materials.js
var maxAnisotropy;//texture filtering

var uvMat;
var phongMat;
var sphereMat;

//##################################################################################################




//##################################################################################################
//ENTITIES


var cols = 10;
var rows = 10;
var total = rows*cols;
var boxSize = 50;

var arBox = [];

var sphere;

var pLight1;
var pLight2;
var pLight3;

var color = new THREE.Color(0xFF0000);
var h;
var s;
var l;

var lY = 200;//light Ypos





//##################################################################################################









function initRenderer(){
	
	renderer = new THREE.WebGLRenderer( {  antialias: true	} );
	canvas = renderer.domElement;  // The canvas was created by the renderer.
	renderer.setSize(window.innerWidth, window.innerHeight);  // match size of canvas to window
	document.body.appendChild(canvas);  // The canvas must be added to the body of the page.
	window.addEventListener("resize", doResize, false);  // Set up handler for resize event
	clock = new THREE.Clock(); // For keeping time during the animation.

	

	//SCENE
	//********************************************************************
    renderer.setClearColor( "rgb(0,0,0)" );
	renderer.shadowMapEnabled = true; //shadows (lights, meshes)

	scene = new THREE.Scene();
    
	
	//scene.background = new THREE.Color( 0x000000 );
	scene.background = new THREE.Color( "rgb(0,0,0)" );//80x80x80
	
	
	cont = new THREE.Group();
	scene.add(cont);
	
	//scene.fog = new THREE.FogExp2( 0xefd1b5, 0.0025 );
	//scene.fog = new THREE.Fog( 0x000000, 700,1000 );
	//scene.fog = new THREE.Fog( "rgb(0,0,0)", 700,1000 );
	
	
	
	//********************************************************************
	
	
	
}




//window resized
//update canvas size, camera aspect ratio
function doResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix(); // Need to call this for the change in aspect to take effect.
  renderer.setSize(window.innerWidth, window.innerHeight);
}
























function initHelpers(){
	controls = new THREE.OrbitControls( camera, renderer.domElement );
	controls.target = new THREE.Vector3(250, 80, 250);
  
	
	/*
	stats = new Stats();
	document.body.appendChild( stats.dom );   
	*/
	
	
	/*
	var axesHelper = new THREE.AxesHelper( 1000 );
	scene.add( axesHelper );
	*/
	
	
	//visualize axes
	//showAxes();
	

}




function showAxes(){
  //line material, not affected by light, to show 0,0,0

  //test point cloud 1 at 0,0,0
  var points = new THREE.Geometry();
  var pt = new THREE.Vector3( 0,0,0 );//x,y,z
  points.vertices.push(pt);

  var pointMaterial = new THREE.PointsMaterial(
              {
                color: "cyan",
                size: 10,
                sizeAttenuation: false //With the sizeAttenuation property set to false, the size is given in pixels; if it is true, then the size is scaled to reflect distance from the viewer.
              }
            );

 

  //  Once we have the geometry and the material, we can use them to create the visible object, of type PointCloud, and add it to a scene:
  var sphereOfPoints = new THREE.Points( points, pointMaterial );
  scene.add( sphereOfPoints );

  //draw 3 lines aligned to the axes, x y z
  drawLine(new THREE.Vector3(0,0,0), new THREE.Vector3(100,0,0), "rgb(255,0,0)");//start, end, color
  drawLine(new THREE.Vector3(0,0,0), new THREE.Vector3(0,100,0), "rgb(0,255,0)");
  drawLine(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,100), "rgb(0,0,255)");
}





function drawLine(start, end, rgb){
  //line material, not affected by light, to show 0,0,0
  var lineGeom = new THREE.Geometry();
  lineGeom.vertices.push( start );
  lineGeom.vertices.push( end );

  var lineMatR = new THREE.LineBasicMaterial( {color:rgb, linewidth:2} );
  var lineMatG = new THREE.LineBasicMaterial( {color:rgb, linewidth:2} );
  var lineMatB = new THREE.LineBasicMaterial( {color:rgb, linewidth:2} );


  var line = new THREE.Line( lineGeom, lineMatR, THREE.LineStrip );

  scene.add(line);





}

















	
	
	
	
function initCamera(){
	//CAMERA
	//********************************************************************
	camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 4000);//fov angle, aspect, near, far
	camera.position.set(250,400,800);
	camera.lookAt(scene.position);
	
	
	scene.add(camera);
	//********************************************************************
	
	
	
}
	
	
	
	
	
	
	
	









function init(){
	
	
	initRenderer();//renderer.js
	initCamera();
	initLights();
	initLoadingManager();
	initMaterials();
	spawnWorld();
	initHelpers();
	
	requestAnimationFrame(main);
	
	
	
	
}





















function initLights(){
	
	
	//DIRECTIONAL LIGHT
	//********************************************************************
	
	/*
	light = new THREE.DirectionalLight( "rgb(255,255,255)", 1.2);//color, intensity
	light.castShadow = true;
	
	light.shadowMapWidth = 1024;
	light.shadowMapHeight = 1024;
	
	light.shadowCameraLeft = -200;
	light.shadowCameraRight = 200;
	light.shadowCameraBottom = -200;
	light.shadowCameraTop = 200;
	light.shadowCameraNear = 1;
	light.shadowCameraFar = 300;
	
	light.position.set(150, 300,150);//0,300,150
    scene.add(light);
	
	var helper = new THREE.DirectionalLightHelper( light, 10 );
	scene.add( helper );
	*/
	
	
	//********************************************************************
	
	//var ambientLight = new THREE.AmbientLight( "rgb(100,100,100)", 1 ); 
	//scene.add( ambientLight );
	
	/*
	var spotLight = new THREE.SpotLight( 0xffffff, 1, 0, Math.PI/3, 0, 2  );
	//( color, intensity, distance, angle, penumbra, decay )
	
	spotLight.position.set( 300, 300, 0 );

	spotLight.castShadow = true;
	spotLight.shadow.mapSize.width = 1024;
	spotLight.shadow.mapSize.height = 1024;
	spotLight.shadow.camera.near = 1;
	spotLight.shadow.camera.far = 1500;
	spotLight.shadow.camera.fov = 30;
	scene.add( spotLight );
	
	var spotLightHelper = new THREE.SpotLightHelper( spotLight );
	scene.add( spotLightHelper );	
	*/
	
	
	//POINT LIGHTs
	//********************************************************************
	
	
	
	pLight1 = newPointLight(0, lY, 0, 0xffffff, 1);
	pLight2 = newPointLight(550, lY, -50, 0xffffff, 1)
	pLight3 = newPointLight(-50, lY, 550, 0xffffff, 1);
	
	//var pLightPar = newPointLight(posX, posY, posZ, color, intensity)
	
	//********************************************************************
	
	
}


	
function newPointLight(posX, posY, posZ, color, intensity){
	var pointLight = new THREE.PointLight( color, intensity, 0, 2 );
	//PointLight( color, intensity, distance(0==infinity), decay (2=physical) )
	
	
	
	pointLight.castShadow = false;
	
	/*
	pointLight.shadowMapWidth = 256;//2048
	pointLight.shadowMapHeight = 256;
	
	pointLight.shadowCameraLeft = -200;
	pointLight.shadowCameraRight = 200;
	pointLight.shadowCameraBottom = -200;
	pointLight.shadowCameraTop = 200;
	pointLight.shadowCameraNear = 1;
	pointLight.shadowCameraFar = 3000;
	*/
	
	
	
	pointLight.position.set(posX, posY, posZ);
	scene.add( pointLight );

	
	/*
	//helper
	var sphereSize = 10;
	var pointLightHelper = new THREE.PointLightHelper( pointLight, sphereSize );
	scene.add( pointLightHelper );
	*/

	
	return pointLight;
	
}





	
	
	
	
function initLoadingManager(){
	
	
	var loadBar = document.createElement("div");
	var loadBarInner = document.createElement("div");
	var loadBarTxt = document.createElement("div");
	
	loadBar.appendChild(loadBarInner);
	loadBar.appendChild(loadBarTxt);
	document.body.appendChild(loadBar);

	loadBarTxt.innerHTML = "Loading...";
	
	
	loadBar.style = "position: absolute;	z-index: 500;right:0px;		left:0px;		top:0px;		bottom:0px;		margin: auto;	width:300px;height:40px;background-color:#555555;border-radius: 4px;";
	
	
	loadBarInner.style ="width:25px;		height:40px;		background-color:#5E9CE5;	border-radius: 4px;";
	
	
	loadBarTxt.style ="color:#fff;position: absolute;z-index:2;right:0px;left:0px;top:10px;bottom:0px;width:300px;height:40px;	text-align:center;";
	
	
	
	THREE.DefaultLoadingManager.onStart = function ( url, itemsLoaded, itemsTotal ) {
		//console.log( "Loading started" );
	};

	
	THREE.DefaultLoadingManager.onProgress = function ( url, itemsLoaded, itemsTotal )
	{		
		var pct = (itemsLoaded * 100) / itemsTotal;
		loadBarTxt.innerHTML = "Loading: " + Math.round(pct) + " %";
		
		var barPct = (pct * 300) / 100;
		loadBarInner.style.width = barPct + "px";		
	};

	
	THREE.DefaultLoadingManager.onLoad = function ( )
	{
		loadBar.style.display = "none";
		assetsLoaded = true;
		//console.log("loading complete");	
	};
	
	
	THREE.DefaultLoadingManager.onError = function ( url )
	{
		console.log( "error loading asset " + url );
	};	

	
}
	
	
	






//main control / render loop
function main() {
	if(assetsLoaded){
		

		//ANIMATE BOXES
		var t = performance.now()/500;
		for(var i=0; i<arBox.length; i++){
			
			var mesh = arBox[i];
			mesh.position.y = Math.sin(mesh.position.x + mesh.position.z + t)*20;
			
		}
		
		
		sphere.position.x = 250 + Math.sin(t/2)*100;
		sphere.position.z = 250 + Math.cos(t/2)*100;
		
		
		
		h = Math.sin(t/25);//0-1
		s = 1;//def=1
		l = 0.5;//def=0.5
		pLight1.color.setHSL(h,s,l);				
		
		
		
		
		
		//update all cubeCameras couple times
		if (updateCubeCams){
			for (var i = 0; i<arCubeCameras.length; i++){
				var mesh = arCubeCameras[i][0];
				var cam = arCubeCameras[i][1];
				
				mesh.visible = false;
				cam.position.copy( mesh.position );
				cam.update( renderer, scene );
				mesh.visible = true;	
			}
		}
		
	
		
		//console.log(camera.position);
		controls.update();
		//stats.update();
		renderer.render(scene, camera);
	}
	requestAnimationFrame(main);
}









function initMaterials(){
	
	maxAnisotropy = renderer.getMaxAnisotropy();
	
	var path;
	var metalnessMap;
	var metalness;
	var roughnessMap;
	var roughness;
	var normalScale;
	
	var reflectivity;//0-1, def=0.5 //applied to non-metalic only
	var clearCoat;//0-1, def=0
	var clearCoatRoughness;//0-1, def=0
	
	var repeat;//repeat map, def=1;
	
	
	
	//uvMat
	path = "materials/uv/";
	metalnessMap = false;
	metalness = 1;
	roughnessMap = false;
	roughness = 0.0;
	normalScale = new THREE.Vector2(1,1);//def 1,1
	reflectivity = 0.5;
	clearCoat = 0;
	clearCoatRoughness = 0;
	repeat = 1;
	uvMat = createMaterial(path, normalScale, metalnessMap, metalness, roughnessMap, roughness, reflectivity, clearCoat, clearCoatRoughness, repeat);
	
	
	//phongMat
	path = "materials/uv/";
	normalScale = new THREE.Vector2(1,1);//def 1,1
	repeat = 1;
	phongMat = createPhongMaterial(path, normalScale, repeat);
	
	
	//sphereMat
	sphereMat = new THREE.MeshPhysicalMaterial({});
	//sphereMat.color = new THREE.Color();
	sphereMat.metalness = 1;
	sphereMat.roughness = 0;
	
	
	
}





function createPhongMaterial(path, normalScale, repeat){
	
	var mat = new THREE.MeshPhongMaterial({});
	
	
	/*
	mat.map = new THREE.TextureLoader().load( path+"albedo" );
	mat.map.anisotropy = maxAnisotropy;
	mat.map.wrapS = THREE.RepeatWrapping;
	mat.map.wrapT = THREE.RepeatWrapping;
	mat.map.repeat.set( repeat, repeat );
	*/
	
	/*
	mat.normalMap = new THREE.TextureLoader().load( path+"normal" );
	mat.normalMap.anisotropy = maxAnisotropy;
	mat.normalScale = normalScale;
	mat.normalMap.wrapS = THREE.RepeatWrapping;
	mat.normalMap.wrapT = THREE.RepeatWrapping;
	mat.normalMap.repeat.set( repeat, repeat );
	*/
	
	//spec color + shininess
	
	
	mat.specular = new THREE.Color(0xffffff);
	mat.shininess = 30;//def=30



	
	
	
	/*
	mat.displacementMap = new THREE.TextureLoader().load( path+"height" );
	mat.displacementMap.anisotropy = maxAnisotropy;
	material.displacementScale = 5;//def=1
	*/
	
	
	
	//mat.wireframe = true;
	return mat;
}




function createMaterial(path, normalScale ,metalnessMap, metalness, roughnessMap, roughness, reflectivity, clearCoat, clearCoatRoughness, repeat){
	
	//var mat = new THREE.MeshStandardMaterial({});
	var mat = new THREE.MeshPhysicalMaterial({});
	mat.reflectivity = reflectivity;//0-1, def=0.5 //applied on non-metal materials only
	mat.clearCoat = clearCoat;//0-1, def=0
	mat.clearCoatRoughness = clearCoatRoughness;//0-1, def=0
	
	
	
	mat.map = new THREE.TextureLoader().load( path+"albedo" );
	mat.map.anisotropy = maxAnisotropy;
	mat.map.wrapS = THREE.RepeatWrapping;
	mat.map.wrapT = THREE.RepeatWrapping;
	mat.map.repeat.set( repeat, repeat );
	
	
	mat.normalMap = new THREE.TextureLoader().load( path+"normal" );
	mat.normalMap.anisotropy = maxAnisotropy;
	mat.normalScale = normalScale;
	mat.normalMap.wrapS = THREE.RepeatWrapping;
	mat.normalMap.wrapT = THREE.RepeatWrapping;
	mat.normalMap.repeat.set( repeat, repeat );
	
	
	
	if (metalnessMap){
		mat.metalnessMap = new THREE.TextureLoader().load( path+"metalness" );
		mat.metalnessMap.anisotropy = maxAnisotropy;
		mat.metalnessMap.wrapS = THREE.RepeatWrapping;
		mat.metalnessMap.wrapT = THREE.RepeatWrapping;
		mat.metalnessMap.repeat.set( repeat, repeat );
	}
	mat.metalness = metalness;
	
	
	if (roughnessMap){
		mat.roughnessMap =  new THREE.TextureLoader().load( path+"roughness" );
		mat.roughnessMap.anisotropy = maxAnisotropy;
		mat.roughnessMap.wrapS = THREE.RepeatWrapping;
		mat.roughnessMap.wrapT = THREE.RepeatWrapping;
		mat.roughnessMap.repeat.set( repeat, repeat );
	}	
	mat.roughness = roughness;
	
	
	/*
	mat.displacementMap = new THREE.TextureLoader().load( path+"height" );
	mat.displacementMap.anisotropy = maxAnisotropy;
	material.displacementScale = 5;//def=1
	*/
	
	
	
	//mat.wireframe = true;
	return mat;
}








function spawnWorld() {
	
	for (var i=0; i<cols; i++){	
		for (var n=0; n<rows; n++){
			arBox.push(spawnBox(i*boxSize+boxSize/2, 0, n*boxSize+boxSize/2));//x,y,z
		}
	}
	
	sphere = spawnSphere();
	
	
	
	
	//SkySphere
	//¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡
	/*
	var textureLoader = new THREE.TextureLoader();

	textureLoader.load( 'img/skyMap.jpg', function ( texture ) {
		texture.mapping = THREE.UVMapping;
		initSphere( texture );
	} );
	
	function initSphere( texture ) {

		var mesh = new THREE.Mesh( new THREE.SphereBufferGeometry( 2000, 64, 32 ),
					new THREE.MeshBasicMaterial( { map: texture } ) );
		
		
		mesh.scale.x = -1;
		mesh.rotation.y = (Math.PI/180)*150;
		
		scene.add( mesh );
	}
	*/
	//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
	
	//spawnTestMesh();
	
	//load entities
	//¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡
	//load entities (exported models + maps + materials)
	//loader.load("models/portal.json", callbackPortal);
	//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
	
	
	
	
}

//-*-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*
//-*-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*


function spawnBox(x, y, z){
	
	var geom = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
	var mat = phongMat.clone();
	mat.color = new THREE.Color();
	var c = 0.2;
	mat.color.setRGB(c,c,c);//0-1
	
	var mesh = new THREE.Mesh( geom, mat );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	cont.add( mesh );
	mesh.position.set(x, y, z);
	
	return mesh;
}






function spawnSphere(){
	
	var geom = new THREE.SphereGeometry( 40, 60,60 );//45
	//var geom = new THREE.BoxGeometry(30,30,30);
	
	
	var mat = sphereMat.clone();
	
	
	var mesh = new THREE.Mesh( geom, mat );
	mesh.castShadow = false;
	mesh.receiveShadow = false;
	scene.add( mesh );
	mesh.position.set(100,100,100);
    
	
	var cam = new THREE.CubeCamera( cubeCamNear, cubeCamFar, cubeCamRes);
	cam.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
	scene.add(cam);
	mesh.material.envMap = cam.renderTarget.texture;
	mesh.material.envMap.anisotropy = maxAnisotropy;
	mesh.material.envMapIntensity = 1;
	arCubeCameras.push ([mesh, cam])
	cam.position.copy(mesh.position);
	
	return mesh;
}








function spawnTestMesh(){
	
	var geom = new THREE.SphereGeometry( 20, 60,60 );
	//var geom = new THREE.BoxGeometry(30,30,30);
	
	
	var mat = darkMarbleMat.clone();
	//var mat = statueMat.clone();
	
	
	
	var mesh = new THREE.Mesh( geom, mat );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	scene.add( mesh );
	mesh.position.set(50,20,50);
    
	
	var cam = new THREE.CubeCamera( cubeCamNear, cubeCamFar, cubeCamRes);
	cam.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
	scene.add(cam);
	mesh.material.envMap = cam.renderTarget.texture;
	mesh.material.envMap.anisotropy = maxAnisotropy;
	mesh.material.envMapIntensity = 1;
	arCubeCameras.push ([mesh, cam])
	cam.position.copy(mesh.position);
}












//statue
//¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡
function callbackPortal(geometry, materials) {
	//executed when model loaded
	//uv data are in geometry, use custom material
	//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
	//fix for blender exporter flip y / z axes
	fix(geometry);
    geometry.normalsNeedUpdate = true;
    geometry.verticesNeedUpdate = true;
	//¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡
	
	
	var mat = floorMat.clone()
	
	
	
	var mesh = new THREE.Mesh( geometry, mat );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	//mesh.material.shading = THREE.FlatShading;
	cont.add(mesh);
	
	var cam = new THREE.CubeCamera( cubeCamNear, cubeCamFar, cubeCamRes);
	cam.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
	cont.add(cam);
	
	mesh.material.envMap = cam.renderTarget.texture;
	mesh.material.envMap.anisotropy = maxAnisotropy;
	mesh.material.envMapIntensity = 1;
	
	arCubeCameras.push ([mesh, cam])
	
	var scale = 20;
	mesh.scale.set(scale,scale,scale);
	//mesh.position.set(0, 0, 0);
	//mesh.rotation.y = (Math.PI/180) * 45;
	
	
	cam.position.copy(mesh.position);
	
	//place cam to the middle of the model (model has bottom at 0)
	geometry.computeBoundingBox();
	cam.position.y = (geometry.boundingBox.max.y / 2)*scale;
	
	portal = mesh;
}
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^



































	
	
	






























































