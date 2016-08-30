Layer Group Atlas
=================

Creator: Tonio Loewald (tloewald (at) popular mail service beginning with g dot com)
Copyright: 2013 Tonio Loewald
License: think nice thoughts of me!

Audience
--------

This is a workflow tool for people who use Photoshop to create user interface layouts.

Instructions
------------

All you need is to have this project somewhere on your computer (keep the folder
relationships). You may want to create an action button in Photoshop to fire the script.

Create a user interface in Photoshop. Each element (or element-state) should end up as 
a different root-level layer or layer group.

Run the script (e.g. by double-clicking it, using File > Scripts > Browse..., or (my
favorite) creating an Action button for it.

Select a destination folder.

Wait a moment and you're done. You should now have two new files named:

 * orig-file-name_atlas.png
 * orig-file-name_metadata.json
 
Using the Output
----------------

The first file is your image atlas (it should also still be open in Photoshop) and
the second file is the position and size information of each element.

It should look something like this:

    {
      "width":1024,
      "height":768,
      "resolution":72,
      "name":"gameplay",
      "path":"~\/Projects\/Sourcebits\/MRG%20Menus",
      "layers":  [
        ...
        {
          "name":"vignette",
          "left":0,
          "top":0,
          "width":1024,
          "height":768,
          "pinX":0.5,
          "pinY":0.5,
          "layer_index":10,
          "packedOrigin":{
            "x":517,
            "y":1
          }
        },
        ...
      ],
      "atlas":{
        "width":2048,
        "height":1024
      }
    }

The layer originally named "vignette" was 1024x768, it's stored at 517,1 in the atlas,
the atlas is 2048x1024 in total, and the original layout was 1024x768.

Note that if you ignore pinning, you can recreate the original layout simply by placing
grabbing each element from the atlas (using its packedOrigin and original dimensions)
and then rendering it at its stored (left,top) coordinates.

If you want a responsive layout (i.e. you want to use pinning) you should take the 
stored (left,top) coordinates and subtract (pinX * width, pinY * height) using the
width and height of the original layout and then add (pinX * width, pinY * height)
using the current view's width and height.

Layer Naming Convention
-----------------------

Naming convention for layers: really anything you like, but I use:

    name[:state][.pinX,pinY]

I don't currently do anything to support the :state part, but pinX and pinY are
stored in the metadata. (The idea is that the coordinates of a given layer are treated
as offsets from that position within the [0,1] representation of the original layout,
so pinning to 0,0 is equivalent to the top-left. By default, everything is pinned to 
the center (i.e. treated as though the layer name ends in ".0.5,0.5").

Customization
-------------

It should be fairly easy to modify the script to deal with specialized groupings -- e.g. 
one group per control, one sub-group be control state.) Similarly, you could eliminate
the "pick a destination folder" step pretty easily. This is a workflow tool -- the 
goal is to turn a layout into an image map as seamlessly as possible.

