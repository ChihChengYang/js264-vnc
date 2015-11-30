// jsmpeg by Dominic Szablewski - phoboslab.org, github.com/phoboslab

(function(window){ "use strict";
 
var	SOCKET_MAGIC_BYTES = 'jsmp'; 
var sequenceStarted2 = false;
//======================================
    var canvas = document.getElementById('videoCanvas');
    var pictureCount = 0;
    var lastPictureCount = 0;
    // Create the decoder and canvas
    var decoder = new Worker('h264bsd_worker.js');
    // var decoder = new Worker('h264bsd_worker.min.js');
    var display = new H264bsdCanvas(canvas);	
	var buf = null;
//======================================
	
var js264 = window.js264 = function( url, opts ) {
	opts = opts || {}; 
	this.canvas = opts.canvas || document.createElement('canvas'); 
	if( url instanceof WebSocket ) {
		this.client = url;
		this.client.onopen = this.initSocketClient.bind(this);		
	} 
	else {
		this.load(url);
	}	
}; 
// ----------------------------------------------------------------------------
// Streaming over WebSockets
js264.prototype.waitForIntraFrame = true;
js264.prototype.socketBufferSize = 5 * 512 * 1024; // 512kb each

js264.prototype.initSocketClient = function( client ) {
	this.client.binaryType = 'arraybuffer';
	this.client.onmessage = this.receiveSocketMessage.bind(this);
};

js264.prototype.decodeSocketHeader = function( data ) {
	// Custom header sent to all newly connected clients when streaming
	// over websockets:
	// struct { char magic[4] = "jsmp"; unsigned short width, height; };
	if( 
		data[0] == SOCKET_MAGIC_BYTES.charCodeAt(0) && 
		data[1] == SOCKET_MAGIC_BYTES.charCodeAt(1) && 
		data[2] == SOCKET_MAGIC_BYTES.charCodeAt(2) && 
		data[3] == SOCKET_MAGIC_BYTES.charCodeAt(3)
	) {
		this.width = (data[4] * 256 + data[5]);
		this.height = (data[6] * 256 + data[7]);
	 
		if( this.sequenceStarted ) { return; }
	    this.sequenceStarted = true;
	
		console.log('JJ ',this.width,this.height); 
	}
	
//======================================
    decoder.addEventListener('error', function(e) {
        console.log('Decoder error', e);
    })

    decoder.addEventListener('message', function(e) {
        var message = e.data;
        if (!message.hasOwnProperty('type')) return;

        switch(message.type) {
        case 'pictureParams':
		console.log('pictureParams ready'); 
            var croppingParams = message.croppingParams;   
            if(croppingParams === null) {
                canvas.width = message.width;
                canvas.height = message.height; 
            } else {
                canvas.width = croppingParams.width;
                canvas.height = croppingParams.height;	 
            }
            break;
        case 'noInput':
            var copy = new Uint8Array(buf);
            decoder.postMessage({
                'type' : 'queueInput',
                'data' : copy.buffer
            }, [copy.buffer]);
            break;
        case 'pictureReady':
            display.drawNextOutputPicture(
                message.width, 
                message.height, 
                message.croppingParams, 
                new Uint8Array(message.data));
                ++pictureCount;
            break;
        case 'decoderReady':
            console.log('Decoder ready');
            break;
        }
    });
//======================================	
}; 

js264.prototype.receiveSocketMessage = function( event ) {
	
	buf = new Uint8Array(event.data);
	if( !this.sequenceStarted ) {
		this.decodeSocketHeader(buf);
		return;
	} 
//======================================	
	if( !this.sequenceStarted2 && buf[0] === 0x00 &&
		buf[1] === 0x00 && buf[2] === 0x00 &&   buf[3] === 0x01 && buf[4] == 0x67 )  {   
		this.sequenceStarted2 = true; 
		console.log('JxJ ',buf.length , buf[0],buf[1],buf[2],buf[3],buf[4] ); 
    }
  
    if( this.sequenceStarted2 ) {
        var copy = new Uint8Array(buf)                
        decoder.postMessage(
           {'type' : 'queueInput', 'data' : copy.buffer}, 
           [copy.buffer]);
 
    }   
//======================================	 
};  
	
})(window);
