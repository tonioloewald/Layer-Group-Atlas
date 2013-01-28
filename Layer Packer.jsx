/*
	Layer Packer
	
	Quick hack to support Texture Packer's JSON output format with naming conventions
	suited for use with Unity (UIToolkit and NGUI in particular).
	
	Tonio Loewald (c)2013
	Derived from earlier work written in 2011-2012
	
	Uses RectanglePacker.js 
	Iv·n Montes <drslump@drslump.biz>, <http://blog.netxus.es>
	
	Thanks also to Richard Dare, author of AtlasMaker -- http://richardjdare.com 
	without whom I wouldn't have found RectanglePacker
	
	Basic Idea
	1)  Build UI in Photoshop. Organize as layer groups (one group per element or
	    element-state) with a sensible naming convention (your choice).
	2)  Press a button in Photoshop.
	3)  You now have all the pieces in a single image ("image atlas"),
	4)  along with JSON containing metadata (the layer group names -> original image position
	    and dimensions, and the dimensions of the source layout), and
    TODO:
	5)  CSS that provides a class for using each image as a sprite.
	
	Suggested naming convention:
	base-name[:state][.pin-x,pin-y], 
	
	e.g.
	continue.0,0 -- the layer group is named continue and is pinned to the top-left
	continue:active.0.5,0.5 -- the layer group is named continue:active and is pinned
        to the center of the view.
	
	Note that the [:state] component is merely part of the item name. How you utilize it
	is entirely up to you. (However, it will map nicely to CSS selectors, where the CSS
	rule for the sprite would end up being .continue:active { .... }.
	
	Image pinning is expressed as a pair of coordinates in [0,1], corresponding to the
	position within the view.
	
	Special Layer Names
	
	.foo
	If the layer name starts with a period then it is treated as a "comment" and skipped.
	
	_foo
	If the layer name starts with an underscore its metadata (position, etc.) will be
	exported but the image won't be added to the atlas.
*/

// enable double clicking from the Macintosh Finder or the Windows Explorer
#target photoshop

#include "lib/RectanglePacker.js"

// in case we double clicked the file
app.bringToFront();

// debug level: 0-2 (0:disable, 1:break on error, 2:break at beginning)
$.level = 1;
// debugger; // launch debugger on next line

/*
    the amount of empty space we'll put around each object in the atlas to ensure
    clean separation -- since there should be no rounding errors (2^n coordinate systems)
    a safetyMargin of 1 should be fine
*/
var safetyMargin = 1;

function process_bounds( bounds ){
	var d = [];
	for( var i = 0; i < bounds.length; i++ ){
		var c = String(bounds[i]);
		c = c.split(' ');
		c = parseInt(c[0]);
		d.push( c );
	}
	d[2] -= d[0];
	d[3] -= d[1];
	return d.join(',');
}

function pad(i){
	if( i < 10 ){
		return "0" + i;
	} else {
		return "" + i;
	}
}

if( app.documents.length == 0 ){
	alert( "No document to process!" );
} else {
	var outputFolder = Folder.selectDialog("Select a folder for the output files");
	if( outputFolder != null ){
		processLayers();
	}
}

// PS stores coordinates as "xxx pixels"
function coord( bound ){
    var c = String(bound).split(' ');
    return parseInt(c[0]);
}

// extract document metadata
function documentMetadata( doc ){
    return {
        width: coord( doc.width ),
        height: coord( doc.height ),
        resolution: doc.resolution,
        name: (doc.name.split("."))[0],
        path: doc.path? doc.path.toString() : ''
    };
}

// extract metadata from layer
function layerMetadata( doc, layer_idx ){
    var layer = doc.layers[layer_idx],
        name_parts = layer.name.split('.'),
        pin = false,
        layer_data = {
            name: name_parts[0],
            left: coord(layer.bounds[0]),
            top: coord(layer.bounds[1]),
            width: coord(layer.bounds[2]) - coord(layer.bounds[0]),
            height: coord(layer.bounds[3]) - coord(layer.bounds[1]),
            pinX: 0.5, // center by default
            pinY: 0.5, // center by default
            layer_index: layer_idx
        };
    if( name_parts.length > 1 ){
        name_parts.shift();
        pin = name_parts.join(".").split(",");
        if(pin.length == 2){
            layer_data.pinX = parseFloat(pin[0]);
            layer_data.pinY = parseFloat(pin[1]);
        }
    }
    
    // Layer bounds can exceed document bounds -- need to deal with this
    if( layer_data.left < 0 ){
        layer_data.width += layer_data.left;
        layer_data.left = 0;
    }
    if( layer_data.top < 0 ){
        layer_data.height += layer_data.top;
        layer_data.top = 0;
    }
    if( layer_data.width + layer_data.left > coord(doc.width) ){
        layer_data.width += coord(doc.width) - layer_data.width - layer_data.left;
    }
    if( layer_data.height + layer_data.height > coord(doc.height) ){
        layer_data.height += coord(doc.height) - layer_data.height - layer_data.top;
    }
    
    return layer_data;
}

function buildAtlas( metadata ){
    var layers = metadata.layers,
        w = 0,
        h = 0,
        used,
        done = false,
        atlas; 
    /*
        we start with the smallest 2^m x 2^n rect that will contain the any
        individual layer, and try to fit our atlas in.
        
        If we fail we double the smaller dimension until we succeed.
    */
    
    // find minimum w and h such that every individual layer will fit
    for( var i = 0; i < layers.length; i++ ){
        var layer = layers[i];
        if( layer.name[0] === "_" ){
            continue;
        }
        if( layer.width + 2 > w ){
            w = layer.width + safetyMargin * 2;
        }
        if( layer.height + 2 > h ){
            h = layer.height + safetyMargin * 2;
        }
    }
    w = Math.pow( 2, Math.floor( Math.log(w) / Math.log(2) + 1 ) );
    h = Math.pow( 2, Math.floor( Math.log(h) / Math.log(2) + 1 ) );
    
    // create our initial atlas
    atlas = new NETXUS.RectanglePacker( w, h );
    
    while( !done ){
        atlas.reset(w, h);
        done = true;
        for( var i = 0; i < layers.length; i++ ){
            var layer = layers[i];
            
            // do not render underscored files
            if( layer.name[0] === "_" ){
                layer.packedOrigin = {x:0,y:0};
                continue;
            }
            var packedOrigin = atlas.findCoords( layers[i].width + 2, layers[i].height + 2 );
            if( packedOrigin !== null ){
                packedOrigin.x += 1;
                packedOrigin.y += 1;
                layer.packedOrigin = packedOrigin;
            } else {
                if( w < h ){
                    w *= 2;
                } else {
                    h *= 2;
                }
                
                done = false;
                break;
            }
        }
    }
    
    used = atlas.getDimensions();
    
    metadata.atlas = { width: w, height: h };
}

function renderAtlas( docRef, metadata ){
    var i,
        layers = metadata.layers,
        pngOptions = new PNGSaveOptions(),
        atlasDoc = app.documents.add(
            metadata.atlas.width, 
            metadata.atlas.height, 
            72, 
            metadata.name + "_atlas", 
            NewDocumentMode.RGB, 
            DocumentFill.TRANSPARENT, 
            1
        );
    
    for( i = 0; i < layers.length; i++ ){
        var layer = layers[i],
            source = docRef.layers[layer.layer_index];
        
        // do not render underscored files
        if( layer.name[0] === "_" ){
            continue;
        }
        app.activeDocument = docRef;    
        source.visible = true;
        var region = [
            [layer.left, layer.top],
            [layer.left + layer.width, layer.top],
            [layer.left + layer.width, layer.top + layer.height],
            [layer.left, layer.top + layer.height],
            [layer.left, layer.top]
        ];
        docRef.selection.select( region );
        docRef.selection.copy( true ); // copy merged
        source.visible = false;
        region = [
            [layer.packedOrigin.x, layer.packedOrigin.y],
            [layer.packedOrigin.x + layer.width, layer.packedOrigin.y],
            [layer.packedOrigin.x + layer.width, layer.packedOrigin.y + layer.height],
            [layer.packedOrigin.x, layer.packedOrigin.y + layer.height],
            [layer.packedOrigin.x, layer.packedOrigin.y]
        ]
        app.activeDocument = atlasDoc;
        atlasDoc.selection.select( region );
        atlasDoc.paste();
    }
    
    atlasDoc.mergeVisibleLayers();
    atlasDoc.saveAs( new File( outputFolder + "/" + metadata.document.name + "_atlas.png" ), pngOptions );
    // atlasDoc.close( SaveOptions.DONOTSAVECHANGES );
}

function json_escape( s ){
    var output = "";
    for( var i = 0; i < s.length; i++ ){
        switch( s[i] ){
            case "\\":
                output += "\\\\";
                break;
            case "/":
                output += "\\/";
                break;
            case "\b":
                output += "\\b";
                break;
            case "\f":
                output += "\\f";
                break;
            case "\n":
                output += "\\n";
                break;
            case "\r":
                output += "\\r";
                break;
            case "\t":
                output += "\\t";
                break;
            case '"':
                output += "\\\"";
                break;
            default:
                output += s[i];
        }
    }
    return output;
}

// Quick and dirty json export
function json( o, indent ){
    var s = "",
        i,
        parts = [];
    
    if( indent === undefined ){
        indent = 0;
    }
    
    function indents( n ){
        var indent = "",
            i;
        for( i = 0; i < n; i++ ){
            indent += "  ";
        }
        return indent;
    }
    
    switch( typeof o ){
        case "number":
            s = o.toString();
            break;
        case "string":
            s = '"' + json_escape(o) + '"';
            break;
        case "object":
            if( typeof o.length === "number" ){
                s = indents( indent ) + '[\n';
                for( i = 0; i < o.length; i++ ){
                    parts.push( indents( indent + 1 ) + json( o[i], indent + 1 ) );
                }
                s += parts.join(",\n");
                s += '\n' + indents( indent ) + ']';
            } else {
                s = '{\n';
                for( i in o ){
                    if( typeof( o[i] ) !== 'function' ){
                        parts.push( indents( indent + 1 ) + '"' + json_escape(i) + '":' + json( o[i], indent + 1 ) );
                    }
                }
                s += parts.join(",\n");
                s += '\n' + indents( indent ) + '}';
            }
            break;
    }
    return s;
}

function saveFile( path, content ){
    var fileObj = new File( path );
    if( fileObj.open( 'w' ) ){
        fileObj.write( content );
        fileObj.close();
    } else {
        alert( "Could not create file: " + path );
    }
}

function processLayers(){
	var docRef = app.activeDocument;
	
	// store the layer visibility going in so we can return to it
	// and hide everything
	var origVis = [];
	for( var i = 0; i < docRef.layers.length; i++ ){
		origVis.push( docRef.layers[i].visible );
		docRef.layers[i].visible = false;
	}
	
	// show each "top level" layer, export a trimmed version
	var metadata = {};
	metadata.application = "{ creator: 'Layer Packer.jsx' }";
	metadata.document = documentMetadata( docRef );
	metadata.layers = [];
	metadata.frames = {};
	for( var i = 0; i < docRef.layers.length; i++ ){				
		var bounds = docRef.layers[i].bounds;
		var layer = docRef.layers[i];
		switch( layer.name.substr(0,1) ){
			case ".":
				// ignore
				break;
			default:
				metadata.layers.push( layerMetadata( docRef, i ) );
		}
	}
	
	buildAtlas( metadata );
	
	renderAtlas( docRef, metadata );
	
	if( metadata.layers.length > 0 ){
	    // convert to Texture Packer format
        for( var i = 0; i < metadata.layers.length; i++ ){
            var layer_data = metadata.layers[i];
            metadata.frames[ layer_data.name ] = {
                "frame": {"x":layer_data.packedOrigin.x,"y":layer_data.packedOrigin.y,"w":layer_data.width,"h":layer_data.width},
                "rotated": false,
                "trimmed": false,
                "spriteSourceSize": {"x":0,"y":0,"w":layer_data.width,"h":layer_data.height},
                "sourceSize": {"w":layer_data.width,"h":layer_data.height}
            };
        }
	    delete metadata.layers;
	    
		saveFile( outputFolder + "/" + metadata.document.name + "_atlas.txt", json( metadata ) );
	}
	
	app.activeDocument = docRef;
	for( var i = 0; i < docRef.layers.length; i++ ){
		docRef.layers[i].visible = origVis[i];
	}
	
	docRef = null;
}