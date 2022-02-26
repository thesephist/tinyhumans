/* oak build --web */
// module system
const __Oak_Modules = {};
let __Oak_Import_Aliases;
function __oak_modularize(name, fn) {
	__Oak_Modules[name] = fn;
}
function __oak_module_import(name) {
	if (typeof __Oak_Modules[name] === 'object') return __Oak_Modules[name];
	const module = __Oak_Modules[name] || __Oak_Modules[__Oak_Import_Aliases[name]];
	if (module) {
		__Oak_Modules[name] = {}; // break circular imports
		return __Oak_Modules[name] = module();
	} else {
		throw new Error(`Could not import Oak module "${name}" at runtime`);
	}
}

// language primitives
let __oak_empty_assgn_tgt;
function __oak_eq(a, b) {
	if (a === __Oak_Empty || b === __Oak_Empty) return true;

	// match either null or undefined to compare correctly against undefined ?s
	// appearing in places like optional arguments
	if (a == null && b == null) return true;
	if (a == null || b == null) return false;

	// match all other types that can be compared cheaply (without function
	// calls for type coercion or recursive descent)
	if (typeof a === 'boolean' || typeof a === 'number' ||
		typeof a === 'symbol' || typeof a === 'function') {
		return a === b;
	}

	// string equality check
	a = __as_oak_string(a);
	b = __as_oak_string(b);
	if (typeof a !== typeof b) return false;
	if (__is_oak_string(a) && __is_oak_string(b)) {
		return a.valueOf() === b.valueOf();
	}

	// deep equality check for composite values
	if (len(a) !== len(b)) return false;
	for (const key of keys(a)) {
		if (!__oak_eq(a[key], b[key])) return false;
	}
	return true;
}
function __oak_acc(tgt, prop) {
	return (__is_oak_string(tgt) ? __as_oak_string(tgt.valueOf()[prop]) : tgt[prop]) ?? null;
}
function __oak_obj_key(x) {
	return typeof x === 'symbol' ? Symbol.keyFor(x) : x;
}
function __oak_push(a, b) {
	a = __as_oak_string(a);
	a.push(b);
	return a;
}
function __oak_and(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a && b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) & get(b, i));
		}
		return res;
	}
	return a & b;
}
function __oak_or(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a || b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) | get(b, i));
		}
		return res;
	}
	return a | b;
}
function __oak_xor(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return (a && !b) || (!a && b);
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) ^ get(b, i));
		}
		return res;
	}
	return a ^ b;
}
const __Oak_Empty = Symbol('__Oak_Empty');

// mutable string type
function __is_oak_string(x) {
	if (x == null) return false;
	return x.__mark_oak_string;
}
function __as_oak_string(x) {
	if (typeof x === 'string') return __Oak_String(x);
	return x;
}
const __Oak_String = s => {
	return {
		__mark_oak_string: true,
		assign(i, slice) {
			if (i === s.length) return s += slice;
			return s = s.substr(0, i) + slice + s.substr(i + slice.length);
		},
		push(slice) {
			s += slice;
		},
		toString() {
			return s;
		},
		valueOf() {
			return s;
		},
		get length() {
			return s.length;
		},
	}
}

// tail recursion trampoline helpers
function __oak_resolve_trampoline(fn, ...args) {
	let rv = fn(...args);
	while (rv && rv.__is_oak_trampoline) {
		rv = rv.fn(...rv.args);
	}
	return rv;
}
function __oak_trampoline(fn, ...args) {
	return {
		__is_oak_trampoline: true,
		fn: fn,
		args: args,
	}
}

// env (builtin) functions

// reflection and types
const __Is_Oak_Node = typeof process === 'object';
const __Oak_Int_RE = /^[+-]?\d+$/;
function int(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') {
		// JS rounds towards higher magnitude, Oak rounds towards higher value
		const rounded = Math.floor(x);
		const diff = x - rounded;
		if (x < 0 && diff === 0.5) return rounded + 1;
		return rounded;
	}
	if (__is_oak_string(x) && __Oak_Int_RE.test(x.valueOf())) {
		const i = Number(x.valueOf());
		if (isNaN(i)) return null;
		return i;
	}
	return null;
}
function float(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') return x;
	if (__is_oak_string(x)) {
		const f = parseFloat(x.valueOf());
		if (isNaN(f)) return null;
		return f;
	}
	return null;
}
function atom(x) {
	x = __as_oak_string(x);
	if (typeof x === 'symbol' && x !== __Oak_Empty) return x;
	if (__is_oak_string(x)) return Symbol.for(x.valueOf());
	return Symbol.for(string(x));
}
function string(x) {
	x = __as_oak_string(x);
	function display(x) {
		x = __as_oak_string(x);
		if (__is_oak_string(x)) {
			return '\'' + x.valueOf().replace('\\', '\\\\').replace('\'', '\\\'') + '\'';
		} else if (typeof x === 'symbol') {
			if (x === __Oak_Empty) return '_';
			return ':' + Symbol.keyFor(x);
		}
		return string(x);
	}
	if (x == null) {
		return '?';
	} else if (typeof x === 'number') {
		return x.toString();
	} else if (__is_oak_string(x)) {
		return x;
	} else if (typeof x === 'boolean') {
		return x.toString();
	} else if (typeof x === 'function') {
		return x.toString();
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return '_';
		return Symbol.keyFor(x);
	} else if (Array.isArray(x)) {
		return '[' + x.map(display).join(', ') + ']';
	} else if (typeof x === 'object') {
		const entries = [];
		for (const key of keys(x).sort()) {
			entries.push(`${key}: ${display(x[key])}`);
		}
		return '{' + entries.join(', ') + '}';
	}
	throw new Error('string() called on unknown type ' + x.toString());
}
function codepoint(c) {
	c = __as_oak_string(c);
	return c.valueOf().charCodeAt(0);
}
function char(n) {
	return String.fromCharCode(n);
}
function type(x) {
	x = __as_oak_string(x);
	if (x == null) {
		return Symbol.for('null');
	} else if (typeof x === 'number') {
		// Many discrete APIs check for :int, so we consider all integer
		// numbers :int and fall back to :float. This is not an airtight
		// solution, but works well enough and the alternative (tagged number
		// values/types) have poor perf tradeoffs.
		if (Number.isInteger(x)) return Symbol.for('int');
		return Symbol.for('float');
	} else if (__is_oak_string(x)) {
		return Symbol.for('string');
	} else if (typeof x === 'boolean') {
		return Symbol.for('bool');
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return Symbol.for('empty');
		return Symbol.for('atom');
	} else if (typeof x === 'function') {
		return Symbol.for('function');
	} else if (Array.isArray(x)) {
		return Symbol.for('list');
	} else if (typeof x === 'object') {
		return Symbol.for('object');
	}
	throw new Error('type() called on unknown type ' + x.toString());
}
function len(x) {
	if (typeof x === 'string' || __is_oak_string(x) || Array.isArray(x)) {
		return x.length;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).length;
	}
	throw new Error('len() takes a string or composite value, but got ' + string(x));
}
function keys(x) {
	if (Array.isArray(x)) {
		const k = [];
		for (let i = 0; i < x.length; i ++) k.push(i);
		return k;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).map(__as_oak_string);
	}
	throw new Error('keys() takes a composite value, but got ' + string(x).valueOf());
}

// OS interfaces
function args() {
	if (__Is_Oak_Node) return process.argv.map(__as_oak_string);
	return [window.location.href];
}
function env() {
	if (__Is_Oak_Node) {
		const e = Object.assign({}, process.env);
		for (const key in e) {
			e[key] = __as_oak_string(e[key]);
		}
		return e;
	}
	return {};
}
function time() {
	return Date.now() / 1000;
}
function nanotime() {
	return int(Date.now() * 1000000);
}
function rand() {
	return Math.random();
}
let randomBytes;
function srand(length) {
	if (__Is_Oak_Node) {
		// lazily import dependency
		if (!randomBytes) randomBytes = require('crypto').randomBytes;
		return randomBytes(length).toString('latin1');
	}

	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return __as_oak_string(Array.from(bytes).map(b => String.fromCharCode(b)).join(''));
}
function wait(duration, cb) {
	setTimeout(cb, duration * 1000);
	return null;
}
function exit(code) {
	if (__Is_Oak_Node) process.exit(code);
	return null;
}
function exec() {
	throw new Error('exec() not implemented');
}

// I/O
function input() {
	throw new Error('input() not implemented');
}
function print(s) {
	s = __as_oak_string(s);
	if (__Is_Oak_Node) {
		process.stdout.write(string(s).toString());
	} else {
		console.log(string(s).toString());
	}
	return s.length;
}
function ls() {
	throw new Error('ls() not implemented');
}
function rm() {
	throw new Error('rm() not implemented');
}
function mkdir() {
	throw new Error('mkdir() not implemented');
}
function stat() {
	throw new Error('stat() not implemented');
}
function open() {
	throw new Error('open() not implemented');
}
function close() {
	throw new Error('close() not implemented');
}
function read() {
	throw new Error('read() not implemented');
}
function write() {
	throw new Error('write() not implemented');
}
function listen() {
	throw new Error('listen() not implemented');
}
function req() {
	throw new Error('req() not implemented');
}

// math
function sin(n) {
	return Math.sin(n);
}
function cos(n) {
	return Math.cos(n);
}
function tan(n) {
	return Math.tan(n);
}
function asin(n) {
	return Math.asin(n);
}
function acos(n) {
	return Math.acos(n);
}
function atan(n) {
	return Math.atan(n);
}
function pow(b, n) {
	return Math.pow(b, n);
}
function log(b, n) {
	return Math.log(n) / Math.log(b);
}

// runtime
function ___runtime_lib() {
	throw new Error('___runtime_lib() not implemented');
}
function ___runtime_lib__oak_qm() {
	throw new Error('___runtime_lib?() not implemented');
}
function ___runtime_gc() {
	throw new Error('___runtime_gc() not implemented');
}
function ___runtime_mem() {
	throw new Error('___runtime_mem() not implemented');
}

// JavaScript interop
function call(target, fn, ...args) {
	return target[Symbol.keyFor(fn)](...args);
}
function __oak_js_new(Constructor, ...args) {
	return new Constructor(...args);
}
function __oak_js_try(fn) {
	try {
		return {
			type: Symbol.for('ok'),
			ok: fn(),
		}
	} catch (e) {
		return {
			type: Symbol.for('error'),
			error: e,
		}
	}
}
(__oak_modularize(__Oak_String(``),function _(){return ((DPI,DrawHeight,DrawWidth,Heads,LeftArms,LeftLegs,Light,Origins,RightArms,RightLegs,Scale,ShadowCanvas,ShadowCtx,SilhouetteCanvas,SilhouetteCtx,SpeechBubbles,SpeechDuration,SpeechFrequency,Torsos,addRandomHumans,angle,append,bearing,choice,circle,__oak_js_default,draw,each,fill,filter,handleResize,indexOf,integer,limb,makeHuman,makeSpeech,map,math,merge,number,partition,path,println,range,shadow,slice,sort)=>(({println,__oak_js_default,range,slice,map,each,filter,merge,append,indexOf,partition}=__oak_module_import(__Oak_String(`std`))),(math=__oak_module_import(__Oak_String(`math`))),(sort=__oak_module_import(__Oak_String(`sort`))),({integer,number,choice}=__oak_module_import(__Oak_String(`random`))),(DPI=__oak_js_default((window.devicePixelRatio??null),1)),(Scale=3),(SpeechDuration=3),(SpeechFrequency=100),(DrawWidth=(window.innerWidth??null)),(DrawHeight=(window.innerHeight??null)),(Light=[DrawWidth,0]),(Origins=[]),(Heads=[]),(Torsos=[]),(LeftArms=[]),(RightArms=[]),(LeftLegs=[]),(RightLegs=[]),(SpeechBubbles=[]),(SilhouetteCanvas=(document.querySelector)(__Oak_String(`#silhouettes`))),(SilhouetteCtx=(SilhouetteCanvas.getContext)(__Oak_String(`2d`))),(ShadowCanvas=(document.querySelector)(__Oak_String(`#shadows`))),(ShadowCtx=(ShadowCanvas.getContext)(__Oak_String(`2d`))),(Canvas=SilhouetteCanvas),(Ctx=SilhouetteCtx),path=function path(points=null){return ((start)=>((start=__oak_acc(points,0)),(Ctx.beginPath)(),(Ctx.moveTo)(__oak_acc(start,0),__oak_acc(start,1)),each(slice(points,1),function _(pt=null){return ((Ctx.lineTo)(__oak_acc(pt,0),__oak_acc(pt,1)))}),(Ctx.stroke)()))()},fill=function fill(points=null){return ((start)=>((Ctx.beginPath)(),(start=__oak_acc(points,0)),(Ctx.moveTo)(__oak_acc(start,0),__oak_acc(start,1)),each(slice(points,1),function _(pt=null){return ((Ctx.lineTo)(__oak_acc(pt,0),__oak_acc(pt,1)))}),(Ctx.fill)()))()},circle=function circle(center=null,radius=null){return ((Ctx.beginPath)(),(Ctx.arc)(__oak_acc(center,0),__oak_acc(center,1),radius,0,(2*(math.Pi??null))),(Ctx.fill)())},angle=function angle(deg=null){return (((__as_oak_string(-deg+90))/180)*(math.Pi??null))},bearing=function bearing(x=null,y=null,angle=null,dist=null){return [__as_oak_string(x+(cos(angle)*dist)),__as_oak_string(y+(sin(angle)*dist))]},limb=function limb(start=null,deg1=null,len1=null,deg2=null,len2=null){let p;return [(p=start),(p=bearing(__oak_acc(p,0),__oak_acc(p,1),angle(deg1),len1)),bearing(__oak_acc(p,0),__oak_acc(p,1),angle(__as_oak_string(deg1+deg2)),len2)]},shadow=function shadow(pt=null,origin=null){return ((ox,oy,skew,squish,x,y)=>(([x=null,y=null]=origin),([ox=null,oy=null]=pt),(squish=((((y-__oak_acc(Light,1)))/DrawHeight)*1.5)),(skew=((((x-__oak_acc(Light,0)))/DrawWidth)*1.5)),[__as_oak_string(ox+(skew*((y-oy)))),(y-(((oy-y))*squish))]))()},makeHuman=function makeHuman(x=null,y=null,posture=null){return ((facing)=>((x=(x-Scale)),(posture=__oak_js_default(posture,({}))),(facing=__oak_js_default((posture.facing??null),choice([Symbol.for('forward'),Symbol.for('left'),Symbol.for('right')]))),(posture=merge(({leftShoulder:number(-80,0),leftElbow:((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('left'))?number(-135,0):__oak_eq(__oak_cond,Symbol.for('right'))?number(0,30):number(-135,20))(facing),rightShoulder:number(0,80),rightElbow:((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('right'))?number(0,135):__oak_eq(__oak_cond,Symbol.for('left'))?number(-30,0):number(-20,135))(facing),leftHip:((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('left'))?number(-70,30):__oak_eq(__oak_cond,Symbol.for('right'))?number(-80,20):number(10,10))(facing),leftKnee:((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('left'))?number(10,80):__oak_eq(__oak_cond,Symbol.for('right'))?number(-80,-10):number(0,10))(facing),rightHip:((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('right'))?number(-30,70):__oak_eq(__oak_cond,Symbol.for('left'))?number(-20,80):number(10,10))(facing),rightKnee:((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('right'))?number(-80,-10):__oak_eq(__oak_cond,Symbol.for('left'))?number(10,80):number(-10,0))(facing)}),posture)),__oak_push(Origins,[x,y]),__oak_push(Heads,((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('left'))?[__as_oak_string(x+Scale),(y-(11*Scale))]:__oak_eq(__oak_cond,Symbol.for('right'))?[__as_oak_string(x+(2*Scale)),(y-(11*Scale))]:[__as_oak_string(x+(1.5*Scale)),(y-(11*Scale))])((posture.facing??null))),__oak_push(Torsos,[[x,(y-(9*Scale))],[__as_oak_string(x+(3*Scale)),(y-(9*Scale))],[__as_oak_string(x+(3*Scale)),(y-(4*Scale))],[x,(y-(4*Scale))]]),__oak_push(LeftArms,limb([x,(y-(8*Scale))],(posture.leftShoulder??null),(2*Scale),(posture.leftElbow??null),(1.5*Scale))),__oak_push(RightArms,limb([__as_oak_string(x+(3*Scale)),(y-(8*Scale))],(posture.rightShoulder??null),(2*Scale),(posture.rightElbow??null),(1.5*Scale))),__oak_push(LeftLegs,limb([__as_oak_string(x+(Scale/2)),(y-(4*Scale))],(posture.leftHip??null),(2*Scale),(posture.leftKnee??null),(2*Scale))),__oak_push(RightLegs,limb([__as_oak_string(x+(Scale*2.5)),(y-(4*Scale))],(posture.rightHip??null),(2*Scale),(posture.rightKnee??null),(2*Scale)))))()},makeSpeech=function makeSpeech(){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?wait(2,function _(){return (makeSpeech())}):((speech,x,y)=>(([x=null,y=null]=choice(Origins)),(speech=[__as_oak_string(x+(1.5*Scale)),(y-(11*Scale)),choice([Symbol.for('left'),Symbol.for('right')]),choice([__Oak_String(`Hello, World!`),__Oak_String(`What's up?`),__Oak_String(`How's it going?`),__Oak_String(`What a day!`),__Oak_String(`Excuse me!`),__Oak_String(`Thank you!`),__Oak_String(`I'm sorry...`),__Oak_String(`No problem!`),__Oak_String(`Of course!`),__Oak_String(`You gotta see this!`),__Oak_String(`Sorry I'm late,`),__Oak_String(`I love you!`),__Oak_String(`It's nothing.`),__Oak_String(`Have you both met?`),__Oak_String(`Never mind...`),__Oak_String(`What do you mean?`),__Oak_String(`You should join us!`),__Oak_String(`Goodbye!`),__Oak_String(`Have a safe flight!`),__Oak_String(`What the #!$?`),__Oak_String(`What happened?`),__Oak_String(`Did you see that tweet?`),__Oak_String(`Are you on Instagram?`)])]),__oak_push(SpeechBubbles,speech),draw(),wait(SpeechDuration,function _(){return ((SpeechBubbles=filter(SpeechBubbles,function _(sp=null){return !__oak_eq(sp,speech)})),draw())}),wait((math.min)((SpeechFrequency/len(Origins)),__as_oak_string(SpeechDuration+1)),function _(){return (makeSpeech())})))())(len(Origins))},draw=function draw(){return ((Gradients)=>((Ctx=ShadowCtx),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(lineWidth,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.lineWidth):(__oak_assgn_tgt.lineWidth)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),Scale),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(strokeStyle,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.strokeStyle):(__oak_assgn_tgt.strokeStyle)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`rgba(0, 0, 0, .3)`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(fillStyle,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.fillStyle):(__oak_assgn_tgt.fillStyle)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`rgba(0, 0, 0, .3)`)),(Ctx.setTransform)(DPI,0,0,DPI,0,0),(Ctx.clearRect)(0,0,(Canvas.width??null),(Canvas.height??null)),each(Heads,function _(head=null,i=null){return (circle(shadow(head,__oak_acc(Origins,__oak_obj_key((i)))),Scale))}),each(Torsos,function _(torso=null,i=null){return ((origin)=>((origin=__oak_acc(Origins,__oak_obj_key((i)))),fill(map(torso,function _(pt=null){return shadow(pt,origin)}))))()}),each(LeftArms,function _(arm=null,i=null){return ((origin)=>((origin=__oak_acc(Origins,__oak_obj_key((i)))),path(map(arm,function _(pt=null){return shadow(pt,origin)}))))()}),each(RightArms,function _(arm=null,i=null){return ((origin)=>((origin=__oak_acc(Origins,__oak_obj_key((i)))),path(map(arm,function _(pt=null){return shadow(pt,origin)}))))()}),each(LeftLegs,function _(leg=null,i=null){return ((origin)=>((origin=__oak_acc(Origins,__oak_obj_key((i)))),path(map(leg,function _(pt=null){return shadow(pt,origin)}))))()}),each(RightLegs,function _(leg=null,i=null){return ((origin)=>((origin=__oak_acc(Origins,__oak_obj_key((i)))),path(map(leg,function _(pt=null){return shadow(pt,origin)}))))()}),(Ctx=SilhouetteCtx),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(lineWidth,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.lineWidth):(__oak_assgn_tgt.lineWidth)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),Scale),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(lineCap,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.lineCap):(__oak_assgn_tgt.lineCap)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`round`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(lineJoin,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.lineJoin):(__oak_assgn_tgt.lineJoin)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`round`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(fillStyle,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.fillStyle):(__oak_assgn_tgt.fillStyle)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`#000000`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(filter,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.filter):(__oak_assgn_tgt.filter)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`none`)),(Ctx.setTransform)(DPI,0,0,DPI,0,0),(Ctx.clearRect)(0,0,(Canvas.width??null),(Canvas.height??null)),(Gradients=map(Origins,function _(origin=null){return ((grad,x,y)=>(([x=null,y=null]=origin),(grad=(Ctx.createLinearGradient)(__as_oak_string(x+Scale),y,...shadow([__as_oak_string(x+(1*Scale)),(y-(4*Scale))],[__as_oak_string(x+Scale),y]))),(grad.addColorStop)(0,__Oak_String(`rgba(0, 0, 0, .2)`)),(grad.addColorStop)(1,__Oak_String(`rgba(0, 0, 0, 0)`)),grad))()})),each(LeftLegs,function _(leg=null,i=null){return ((grad,origin)=>((origin=__oak_acc(Origins,__oak_obj_key((i)))),(grad=__oak_acc(Gradients,__oak_obj_key((i)))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(strokeStyle,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.strokeStyle):(__oak_assgn_tgt.strokeStyle)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),grad),path(map(leg,function _(pt=null){return shadow(pt,origin)}))))()}),each(RightLegs,function _(leg=null,i=null){return ((grad,origin)=>((origin=__oak_acc(Origins,__oak_obj_key((i)))),(grad=__oak_acc(Gradients,__oak_obj_key((i)))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(strokeStyle,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.strokeStyle):(__oak_assgn_tgt.strokeStyle)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),grad),path(map(leg,function _(pt=null){return shadow(pt,origin)}))))()}),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(strokeStyle,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.strokeStyle):(__oak_assgn_tgt.strokeStyle)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`#000000`)),each(Heads,function _(head=null){return circle(head,Scale)}),each(Torsos,function _(torso=null){return fill(torso)}),each(LeftArms,function _(arm=null){return path(arm)}),each(RightArms,function _(arm=null){return path(arm)}),each(LeftLegs,function _(leg=null){return path(leg)}),each(RightLegs,function _(leg=null){return path(leg)}),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(lineWidth,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.lineWidth):(__oak_assgn_tgt.lineWidth)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),1),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(textAlign,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.textAlign):(__oak_assgn_tgt.textAlign)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`center`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(font,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.font):(__oak_assgn_tgt.font)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(Ctx),__Oak_String(`normal 12px system-ui, sans-serif`)),each(SpeechBubbles,function _(speech=null){return ((dir,endpoint,midpoint,start,text,x,y)=>(([x=null,y=null,dir=null,text=null]=speech),(start=bearing(x,y,((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('left'))?angle(-90):angle(90))(dir),(2.5*Scale))),(midpoint=bearing(x,y,((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('left'))?angle(-105):angle(100))(dir),(5*Scale))),(endpoint=bearing(__oak_acc(midpoint,0),__oak_acc(midpoint,1),((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('left'))?angle(-150):angle(150))(dir),(3*Scale))),path([start,midpoint,endpoint]),(Ctx.fillText)(text,__oak_acc(endpoint,0),(__oak_acc(endpoint,1)-(2*Scale)))))()})))()},handleResize=function handleResize(){return ((DrawWidth=(window.innerWidth??null)),(DrawHeight=(window.innerHeight??null)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(width,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.width):(__oak_assgn_tgt.width)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(SilhouetteCanvas),int(((window.innerWidth??null)*DPI))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(height,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.height):(__oak_assgn_tgt.height)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(SilhouetteCanvas),int(((window.innerHeight??null)*DPI))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(width,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.width):(__oak_assgn_tgt.width)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((SilhouetteCanvas.style??null)),__as_oak_string(string(DrawWidth)+__Oak_String(`px`))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(height,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.height):(__oak_assgn_tgt.height)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((SilhouetteCanvas.style??null)),__as_oak_string(string(DrawHeight)+__Oak_String(`px`))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(width,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.width):(__oak_assgn_tgt.width)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(ShadowCanvas),int(((window.innerWidth??null)*DPI))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(height,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.height):(__oak_assgn_tgt.height)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(ShadowCanvas),int(((window.innerHeight??null)*DPI))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(width,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.width):(__oak_assgn_tgt.width)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((ShadowCanvas.style??null)),__as_oak_string(string(DrawWidth)+__Oak_String(`px`))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(height,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.height):(__oak_assgn_tgt.height)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((ShadowCanvas.style??null)),__as_oak_string(string(DrawHeight)+__Oak_String(`px`))),draw())},addRandomHumans=function addRandomHumans(n=null){return ((cx,cy,inCenter__oak_qm,margin,randomCoord)=>((margin=(Scale*12)),randomCoord=function randomCoord(){return [integer(margin,(DrawWidth-margin)),integer(margin,(DrawHeight-margin))]},(cx=(DrawWidth/2)),(cy=(DrawHeight/2)),inCenter__oak_qm=function inCenter__oak_qm(pt=null){return ((x,y)=>(([x=null,y=null]=pt),(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(__as_oak_string(__as_oak_string(cy+50)+(14*Scale))>y)))((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(((cy-50)-(5*Scale))<y)))((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(__as_oak_string(cx+110)>x)))(((cx-110)<x))))))()},each(filter(map(range(n),randomCoord),function _(pt=null){return !inCenter__oak_qm(pt)}),function _(pt=null){return makeHuman(__oak_acc(pt,0),__oak_acc(pt,1))}),draw()))()},handleResize(),(window.addEventListener)(__Oak_String(`resize`),handleResize),(Canvas.addEventListener)(__Oak_String(`click`),function _(evt=null){return ((__oak_cond)=>__oak_eq(__oak_cond,(evt.altKey??null))?((x,y)=>(({clientX:x=null,clientY:y=null}=evt),(Light=[x,y]),draw()))():__oak_eq(__oak_cond,(evt.metaKey??null))?((x,y)=>(({clientX:x=null,clientY:y=null}=evt),(Light=[x,y]),draw()))():__oak_eq(__oak_cond,(evt.shiftKey??null))?((atIndex__oak_qm,closestHumanIndex,closestHumanOrigin,x,y)=>(({clientX:x=null,clientY:y=null}=evt),(closestHumanOrigin=__oak_acc((sort.sort)(Origins,function _(origin=null){return ((ox,oy)=>(([ox=null,oy=null]=origin),__as_oak_string((((x-ox))*((x-ox)))+(((y-oy))*((y-oy))))))()}),0)),(closestHumanIndex=indexOf(Origins,closestHumanOrigin)),(atIndex__oak_qm=function _(__oak_empty_ident0=null,i=null){return !__oak_eq(i,closestHumanIndex)}),(Origins=filter(Origins,atIndex__oak_qm)),(Heads=filter(Heads,atIndex__oak_qm)),(Torsos=filter(Torsos,atIndex__oak_qm)),(LeftArms=filter(LeftArms,atIndex__oak_qm)),(RightArms=filter(RightArms,atIndex__oak_qm)),(LeftLegs=filter(LeftLegs,atIndex__oak_qm)),(RightLegs=filter(RightLegs,atIndex__oak_qm)),draw()))():(makeHuman((evt.clientX??null),(evt.clientY??null)),draw()))(true)}),((document.querySelector)(__Oak_String(`.clickMapButton`)).addEventListener)(__Oak_String(`click`),function _(evt=null){return ((originalText)=>((originalText=((evt.target??null).textContent??null)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(textContent,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.textContent):(__oak_assgn_tgt.textContent)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((evt.target??null)),__Oak_String(`not here! the map!!`)),wait(2,function _(){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(textContent,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.textContent):(__oak_assgn_tgt.textContent)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((evt.target??null)),originalText))})))()}),((document.querySelector)(__Oak_String(`.randomizeButton`)).addEventListener)(__Oak_String(`click`),function _(){return (addRandomHumans(10))}),((document.querySelector)(__Oak_String(`.clearButton`)).addEventListener)(__Oak_String(`click`),function _(){return ((Origins=[]),(Heads=[]),(Torsos=[]),(LeftArms=[]),(RightArms=[]),(LeftLegs=[]),(RightLegs=[]),(SpeechBubbles=[]),draw())}),((document.querySelector)(__Oak_String(`.hideButton`)).addEventListener)(__Oak_String(`click`),function _(){return ((app)=>((app=(document.querySelector)(__Oak_String(`#app`))),((app.parentNode??null).removeChild)(app)))()}),addRandomHumans((math.max)(12,int((((window.innerWidth??null)*(window.innerHeight??null))/40000)))),makeSpeech(),({DPI,DrawHeight,DrawWidth,Heads,LeftArms,LeftLegs,Light,Origins,RightArms,RightLegs,Scale,ShadowCanvas,ShadowCtx,SilhouetteCanvas,SilhouetteCtx,SpeechBubbles,SpeechDuration,SpeechFrequency,Torsos,addRandomHumans,angle,append,bearing,choice,circle,__oak_js_default,draw,each,fill,filter,handleResize,indexOf,integer,limb,makeHuman,makeSpeech,map,math,merge,number,partition,path,println,range,shadow,slice,sort})))()}),__oak_modularize(__Oak_String(`math`),function _(){return ((E,Pi,abs,bearing,clamp,__oak_js_default,hypot,map,max,mean,median,min,orient,prod,reduce,round,scale,sign,sort,sqrt,stddev,sum)=>(({__oak_js_default,map,reduce}=__oak_module_import(__Oak_String(`std`))),({sort}=__oak_module_import(__Oak_String(`sort`))),(Pi=3.141592653589793),(E=2.718281828459045),sign=function sign(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?1:-1)((n>=0))},abs=function abs(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?n:-n)((n>=0))},sqrt=function sqrt(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?pow(n,0.5):null)((n>=0))},hypot=function hypot(x0=null,y0=null,x1=null,y1=null){return (((__oak_cond)=>__oak_eq(__oak_cond,true)?(x1=(y1=0)):null)((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,__oak_eq(y1,null)))(__oak_eq(x1,null))),sqrt(__as_oak_string((((x0-x1))*((x0-x1)))+(((y0-y1))*((y0-y1))))))},scale=function scale(x=null,a=null,b=null,c=null,d=null){return ((normed)=>((normed=(((x-a))/((b-a)))),((__oak_cond)=>__oak_eq(__oak_cond,(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,__oak_eq(d,null)))(__oak_eq(c,null)))?normed:__as_oak_string((((d-c))*normed)+c))(true)))()},bearing=function bearing(x=null,y=null,d=null,t=null){return [__as_oak_string(x+(d*cos(t))),__as_oak_string(y+(d*sin(t)))]},orient=function orient(x0=null,y0=null,x1=null,y1=null){return ((x,y)=>(([x=null,y=null]=((__oak_cond)=>__oak_eq(__oak_cond,true)?[x0,y0]:[(x1-x0),(y1-y0)])((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,__oak_eq(y1,null)))(__oak_eq(x1,null)))),((__oak_cond)=>__oak_eq(__oak_cond,(x>0))?(2*atan((y/(__as_oak_string(hypot(x,y)+x))))):__oak_eq(__oak_cond,(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,!__oak_eq(y,0)))((x<=0)))?(2*atan((((hypot(x,y)-x))/y))):__oak_eq(__oak_cond,(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,__oak_eq(y,0)))((x<0)))?Pi:null)(true)))()},sum=function sum(...xs){return reduce(xs,0,function _(a=null,b=null){return __as_oak_string(a+b)})},prod=function prod(...xs){return reduce(xs,1,function _(a=null,b=null){return (a*b)})},min=function min(...xs){return reduce(xs,__oak_acc(xs,0),function _(acc=null,n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?n:acc)((n<acc))})},max=function max(...xs){return reduce(xs,__oak_acc(xs,0),function _(acc=null,n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?n:acc)((n>acc))})},clamp=function clamp(x=null,a=null,b=null){return ((__oak_cond)=>__oak_eq(__oak_cond,(x<a))?a:__oak_eq(__oak_cond,(x>b))?b:x)(true)},mean=function mean(xs=null){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?null:(sum(...xs)/len(xs)))(len(xs))},median=function median(xs=null){return ((count,half)=>((xs=sort(xs)),(count=len(xs)),(half=int((count/2))),((__oak_cond)=>__oak_eq(__oak_cond,count)?null:__oak_eq(__oak_cond,(count%2))?((__as_oak_string(__oak_acc(xs,__oak_obj_key(((half-1))))+__oak_acc(xs,__oak_obj_key((half)))))/2):__oak_acc(xs,__oak_obj_key((half))))(0)))()},stddev=function stddev(xs=null){let xmean;return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(sqrt(mean(map(xs,function _(x=null){return pow((xmean-x),2)})))):null)(!__oak_eq(null,(xmean=mean(xs))))},round=function round(n=null,decimals=null){return ((decimals=__oak_js_default(int(decimals),0)),((__oak_cond)=>__oak_eq(__oak_cond,true)?n:((order)=>((order=pow(10,decimals)),((__oak_cond)=>__oak_eq(__oak_cond,true)?(int(__as_oak_string((n*order)+0.5))/order):(-int(__as_oak_string((-n*order)+0.5))/order))((n>=0))))())((decimals<0)))},({E,Pi,abs,bearing,clamp,__oak_js_default,hypot,map,max,mean,median,min,orient,prod,reduce,round,scale,sign,sort,sqrt,stddev,sum})))()}),__oak_modularize(__Oak_String(`random`),function _(){return ((boolean,choice,integer,number)=>(boolean=function boolean(){return (rand()>0.5)},integer=function integer(min=null,max=null){return int(number(int(min),int(max)))},number=function number(min=null,max=null){return (((__oak_cond)=>__oak_eq(__oak_cond,true)?([min=null,max=null]=[0,min]):null)(__oak_eq(max,null)),__as_oak_string(min+(rand()*((max-min)))))},choice=function choice(list=null){return __oak_acc(list,__oak_obj_key((integer(0,len(list)))))},({boolean,choice,integer,number})))()}),__oak_modularize(__Oak_String(`sort`),function _(){return ((clone,__oak_js_default,id,map,sort,sort__oak_exclam)=>(({__oak_js_default,identity:id=null,map,clone}=__oak_module_import(__Oak_String(`std`))),sort__oak_exclam=function sort__oak_exclam(xs=null,pred=null){return ((partition,quicksort,vpred)=>((pred=__oak_js_default(pred,id)),(vpred=map(xs,pred)),partition=function partition(xs=null,lo=null,hi=null){return ((lsub,pivot,rsub,sub)=>((pivot=__oak_acc(vpred,__oak_obj_key((lo)))),lsub=function lsub(i=null){return ((__oak_trampolined_lsub)=>((__oak_trampolined_lsub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_lsub,__as_oak_string(i+1)):i)((__oak_acc(vpred,__oak_obj_key((i)))<pivot))}),__oak_resolve_trampoline(__oak_trampolined_lsub,i)))()},rsub=function rsub(j=null){return ((__oak_trampolined_rsub)=>((__oak_trampolined_rsub=function _(j=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_rsub,(j-1)):j)((__oak_acc(vpred,__oak_obj_key((j)))>pivot))}),__oak_resolve_trampoline(__oak_trampolined_rsub,j)))()},sub=function sub(i=null,j=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null,j=null){return ((i=lsub(i)),(j=rsub(j)),((__oak_cond)=>__oak_eq(__oak_cond,false)?j:((tmp,tmpPred)=>((tmp=__oak_acc(xs,__oak_obj_key((i)))),(tmpPred=__oak_acc(vpred,__oak_obj_key((i)))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((i),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((i))]):(__oak_assgn_tgt[__oak_obj_key((i))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(xs),__oak_acc(xs,__oak_obj_key((j)))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((j),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((j))]):(__oak_assgn_tgt[__oak_obj_key((j))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(xs),tmp),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((i),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((i))]):(__oak_assgn_tgt[__oak_obj_key((i))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(vpred),__oak_acc(vpred,__oak_obj_key((j)))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((j),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((j))]):(__oak_assgn_tgt[__oak_obj_key((j))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(vpred),tmpPred),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1),(j-1))))())((i<j)))}),__oak_resolve_trampoline(__oak_trampolined_sub,i,j)))()},sub(lo,hi)))()},quicksort=function quicksort(xs=null,lo=null,hi=null){return ((__oak_trampolined_quicksort)=>((__oak_trampolined_quicksort=function _(xs=null,lo=null,hi=null){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?xs:__oak_eq(__oak_cond,1)?xs:((__oak_cond)=>__oak_eq(__oak_cond,false)?xs:((p)=>((p=partition(xs,lo,hi)),quicksort(xs,lo,p),__oak_trampoline(__oak_trampolined_quicksort,xs,__as_oak_string(p+1),hi)))())((lo<hi)))(len(xs))}),__oak_resolve_trampoline(__oak_trampolined_quicksort,xs,lo,hi)))()},quicksort(xs,0,(len(xs)-1))))()},sort=function sort(xs=null,pred=null){return sort__oak_exclam(clone(xs),pred)},({clone,__oak_js_default,id,map,sort,sort__oak_exclam})))()}),__oak_modularize(__Oak_String(`std`),function _(){return ((_asPredicate,_baseIterator,_hToN,_nToH,append,clamp,clone,compact,contains__oak_qm,debounce,__oak_js_default,each,entries,every,filter,find,first,flatten,fromHex,identity,indexOf,join,last,loop,map,merge,once,partition,println,range,reduce,reverse,slice,some,take,takeLast,toHex,uniq,values,zip)=>(identity=function identity(x=null){return x},_baseIterator=function _baseIterator(v=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('string'))?__Oak_String(``):__oak_eq(__oak_cond,Symbol.for('list'))?[]:__oak_eq(__oak_cond,Symbol.for('object'))?({}):null)(type(v))},_asPredicate=function _asPredicate(pred=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('atom'))?((prop)=>((prop=string(pred)),function _(x=null){return __oak_acc(x,__oak_obj_key((prop)))}))():__oak_eq(__oak_cond,Symbol.for('string'))?function _(x=null){return __oak_acc(x,__oak_obj_key((pred)))}:__oak_eq(__oak_cond,Symbol.for('int'))?function _(x=null){return __oak_acc(x,__oak_obj_key((pred)))}:pred)(type(pred))},__oak_js_default=function __oak_js_default(x=null,base=null){return ((__oak_cond)=>__oak_eq(__oak_cond,null)?base:x)(x)},(_nToH=__Oak_String(`0123456789abcdef`)),toHex=function toHex(n=null){return ((sub)=>(sub=function sub(p=null,acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(p=null,acc=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__as_oak_string(__oak_acc(_nToH,__oak_obj_key((p)))+acc):__oak_trampoline(__oak_trampolined_sub,int((p/16)),__as_oak_string(__oak_acc(_nToH,__oak_obj_key(((p%16))))+acc)))((p<16))}),__oak_resolve_trampoline(__oak_trampolined_sub,p,acc)))()},sub(int(n),__Oak_String(``))))()},(_hToN=({0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,a:10,A:10,b:11,B:11,c:12,C:12,d:13,D:13,e:14,E:14,f:15,F:15})),fromHex=function fromHex(s=null){return ((sub)=>(sub=function sub(i=null,acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null,acc=null){let next;return ((__oak_cond)=>__oak_eq(__oak_cond,__oak_eq(i,len(s)))?acc:__oak_eq(__oak_cond,!__oak_eq(null,(next=__oak_acc(_hToN,__oak_obj_key((__oak_acc(s,__oak_obj_key((i)))))))))?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1),__as_oak_string((acc*16)+next)):null)(true)}),__oak_resolve_trampoline(__oak_trampolined_sub,i,acc)))()},sub(0,0)))()},clamp=function clamp(min=null,max=null,n=null,m=null){return ((n=((__oak_cond)=>__oak_eq(__oak_cond,true)?min:n)((n<min))),(m=((__oak_cond)=>__oak_eq(__oak_cond,true)?min:m)((m<min))),(m=((__oak_cond)=>__oak_eq(__oak_cond,true)?max:m)((m>max))),(n=((__oak_cond)=>__oak_eq(__oak_cond,true)?m:n)((n>m))),[n,m])},slice=function slice(xs=null,min=null,max=null){return ((sub)=>((min=__oak_js_default(min,0)),(max=__oak_js_default(max,len(xs))),([min=null,max=null]=clamp(0,len(xs),min,max)),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,max)?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,__oak_acc(xs,__oak_obj_key((i)))),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),min)))()},clone=function clone(x=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('string'))?__as_oak_string(__Oak_String(``)+x):__oak_eq(__oak_cond,Symbol.for('list'))?slice(x):__oak_eq(__oak_cond,Symbol.for('object'))?reduce(keys(x),({}),function _(acc=null,key=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((key),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((key))]):(__oak_assgn_tgt[__oak_obj_key((key))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(acc),__oak_acc(x,__oak_obj_key((key))))}):x)(type(x))},range=function range(start=null,end=null,step=null){return ((step=__oak_js_default(step,1)),((__oak_cond)=>__oak_eq(__oak_cond,true)?([start=null,end=null]=[0,start]):null)(__oak_eq(end,null)),((__oak_cond)=>__oak_eq(__oak_cond,0)?[]:((list,sub)=>((list=[]),((__oak_cond)=>__oak_eq(__oak_cond,true)?sub=function sub(n=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(__oak_push(list,n),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(n+step))):list)((n<end))}),__oak_resolve_trampoline(__oak_trampolined_sub,n)))()}:sub=function sub(n=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(__oak_push(list,n),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(n+step))):list)((n>end))}),__oak_resolve_trampoline(__oak_trampolined_sub,n)))()})((step>0)),sub(start)))())(step))},reverse=function reverse(xs=null){return ((sub)=>(sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,__oak_acc(xs,__oak_obj_key((i)))),(i-1)))((i<0))}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),(len(xs)-1))))()},map=function map(xs=null,f=null){return ((sub)=>((f=_asPredicate(f)),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,f(__oak_acc(xs,__oak_obj_key((i))),i)),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),0)))()},each=function each(xs=null,f=null){return ((sub)=>(sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?null:(f(__oak_acc(xs,__oak_obj_key((i))),i),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},filter=function filter(xs=null,f=null){return ((sub)=>((f=_asPredicate(f)),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?acc:((x)=>(((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_push(acc,x):null)(f((x=__oak_acc(xs,__oak_obj_key((i)))),i)),__oak_trampoline(__oak_trampolined_sub,acc,__as_oak_string(i+1))))())(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),0)))()},reduce=function reduce(xs=null,seed=null,f=null){return ((sub)=>(sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?acc:__oak_trampoline(__oak_trampolined_sub,f(acc,__oak_acc(xs,__oak_obj_key((i))),i),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(seed,0)))()},flatten=function flatten(xs=null){return reduce(xs,[],append)},compact=function compact(xs=null){return filter(xs,function _(x=null){return !__oak_eq(x,null)})},some=function some(xs=null,pred=null){return ((pred=__oak_js_default(pred,identity)),reduce(xs,false,function _(acc=null,x=null,i=null){return (__oak_left=>__oak_left===true?true:__oak_or(__oak_left,pred(x,i)))(acc)}))},every=function every(xs=null,pred=null){return ((pred=__oak_js_default(pred,identity)),reduce(xs,true,function _(acc=null,x=null,i=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,pred(x,i)))(acc)}))},append=function append(xs=null,ys=null){return reduce(ys,xs,function _(zs=null,y=null){return __oak_push(zs,y)})},join=function join(xs=null,ys=null){return append(clone(xs),ys)},zip=function zip(xs=null,ys=null,zipper=null){return ((max,sub)=>((zipper=__oak_js_default(zipper,function _(x=null,y=null){return [x,y]})),(max=((__oak_cond)=>__oak_eq(__oak_cond,true)?len(xs):len(ys))((len(xs)<len(ys)))),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,max)?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,zipper(__oak_acc(xs,__oak_obj_key((i))),__oak_acc(ys,__oak_obj_key((i))),i)),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub([],0)))()},partition=function partition(xs=null,by=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('int'))?reduce(xs,[],function _(acc=null,x=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?__oak_push(acc,[x]):(__oak_push(__oak_acc(acc,__oak_obj_key(((len(acc)-1)))),x),acc))((i%by))}):__oak_eq(__oak_cond,Symbol.for('function'))?((last)=>((last=function _(){return null}),reduce(xs,[],function _(acc=null,x=null){return ((__oak_js_this)=>(((__oak_cond)=>__oak_eq(__oak_cond,last)?__oak_push(__oak_acc(acc,__oak_obj_key(((len(acc)-1)))),x):__oak_push(acc,[x]))((__oak_js_this=by(x))),(last=__oak_js_this),acc))()})))():null)(type(by))},uniq=function uniq(xs=null,pred=null){return ((last,sub,ys)=>((pred=__oak_js_default(pred,identity)),(ys=_baseIterator(xs)),(last=function _(){return null}),sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){let p;let x;return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?ys:((__oak_cond)=>__oak_eq(__oak_cond,last)?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)):(__oak_push(ys,x),(last=p),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1))))((p=pred((x=__oak_acc(xs,__oak_obj_key((i))))))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},first=function first(xs=null){return __oak_acc(xs,0)},last=function last(xs=null){return __oak_acc(xs,__oak_obj_key(((len(xs)-1))))},take=function take(xs=null,n=null){return slice(xs,0,n)},takeLast=function takeLast(xs=null,n=null){return slice(xs,(len(xs)-n))},find=function find(xs=null,pred=null){return ((sub)=>(sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?-1:((__oak_cond)=>__oak_eq(__oak_cond,true)?i:__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)))(pred(__oak_acc(xs,__oak_obj_key((i))))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},indexOf=function indexOf(xs=null,x=null){return ((sub)=>(sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?-1:((__oak_cond)=>__oak_eq(__oak_cond,x)?i:__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)))(__oak_acc(xs,__oak_obj_key((i)))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},contains__oak_qm=function contains__oak_qm(xs=null,x=null){return (indexOf(xs,x)>-1)},values=function values(obj=null){return map(keys(obj),function _(key=null){return __oak_acc(obj,__oak_obj_key((key)))})},entries=function entries(obj=null){return map(keys(obj),function _(key=null){return [key,__oak_acc(obj,__oak_obj_key((key)))]})},merge=function merge(...os){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?null:reduce(os,__oak_acc(os,0),function _(acc=null,o=null){return (reduce(keys(o),acc,function _(root=null,k=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((k),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((k))]):(__oak_assgn_tgt[__oak_obj_key((k))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(root),__oak_acc(o,__oak_obj_key((k))))}))}))(len(os))},once=function once(f=null){return ((called__oak_qm)=>((called__oak_qm=false),function _(...args){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((called__oak_qm=true),f(...args)):null)(!called__oak_qm)}))()},loop=function loop(max=null,f=null){return ((breaker,broken,sub)=>(((__oak_cond)=>__oak_eq(__oak_cond,true)?([max=null,f=null]=[-1,max]):null)(__oak_eq(f,null)),(max=__oak_js_default(max,-1)),(broken=false),breaker=function breaker(){return (broken=true)},sub=function sub(count=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(count=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(((__oak_cond)=>__oak_eq(__oak_cond,true)?(f(count,breaker),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(count+1))):null)(!broken)):null)(!__oak_eq(count,max))}),__oak_resolve_trampoline(__oak_trampolined_sub,count)))()},sub(0)))()},debounce=function debounce(duration=null,firstCall=null,f=null){return ((dargs,debounced,target,waiting__oak_qm)=>(((__oak_cond)=>__oak_eq(__oak_cond,true)?([firstCall=null,f=null]=[Symbol.for('trailing'),firstCall]):null)(__oak_eq(f,null)),(dargs=null),(waiting__oak_qm=false),(target=(time()-duration)),debounced=function debounced(...args){return ((tcall)=>((tcall=time()),(dargs=args),((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_cond)=>__oak_eq(__oak_cond,true)?((target=__as_oak_string(tcall+duration)),((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('leading'))?f(...dargs):__oak_eq(__oak_cond,Symbol.for('trailing'))?((waiting__oak_qm=true),wait((target-time()),function _(){return ((waiting__oak_qm=false),f(...dargs))})):null)(firstCall)):((timeout)=>((waiting__oak_qm=true),(timeout=(target-tcall)),(target=__as_oak_string(target+duration)),wait(timeout,function _(){return ((waiting__oak_qm=false),f(...dargs))})))())((target<=tcall)):null)(!waiting__oak_qm)))()}))()},println=function println(...xs){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?print(__Oak_String(`
`)):((out)=>((out=reduce(slice(xs,1),string(__oak_acc(xs,0)),function _(acc=null,x=null){return (__as_oak_string(__as_oak_string(acc+__Oak_String(` `))+string(x)))})),print(__as_oak_string(out+__Oak_String(`
`)))))())(len(xs))},({_asPredicate,_baseIterator,_hToN,_nToH,append,clamp,clone,compact,contains__oak_qm,debounce,__oak_js_default,each,entries,every,filter,find,first,flatten,fromHex,identity,indexOf,join,last,loop,map,merge,once,partition,println,range,reduce,reverse,slice,some,take,takeLast,toHex,uniq,values,zip})))()}),(__Oak_Import_Aliases=({})),__oak_module_import(__Oak_String(``)))