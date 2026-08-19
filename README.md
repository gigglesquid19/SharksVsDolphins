For document access >View on Github<
For web access https://gigglesquid19.github.io/Agent-based-Model/

Contents
-------------------
- README
- License File
- Agent-based Model.py (contains the main abm source code)
- agentframework.py (contains Classes and Functions)
- Source Code Documentation https://gigglesquid19.github.io/Agent-based-Model/agentframeworkdocs.html

Software Outline
--------------------
An agent-based model is a class of computational models for simulating the actions and interactions of autonomous agents with a view to assessing their effects on the system as a whole. This model specifically is a small-scale representation of biotic interactions between a population of deer and wolves in an enclosed, 2-D environment.

Features
--------------------
- Choose the number of deer
- Choose the number of wolves
- Choose the number of model iterations
- Choose a neighborhood value (how close agents must be for interaction to occur)

How to use?
--------------------
1) Download and open Agentbasedmodel.py within a python IDE
2) Download and open agentframework.py within a python IDE
3) Within Agentbasedmodel ensure associated script (agent framework) is imported:
4) Ensure both scripts are within the same working directory
5) Run >

What to expect?
---------------------
Once run, a GUI will open on the screen showcasing a number of Wolves (white) and Deer (green) agents. The wolves will roam the environment faster than the deer. As they roam, their energy will decrease until it reaches a critical point. At this point, if within the neighborhood value to a Deer, it will consume the Deer and recouperate it's energy levels. Deer will roam their environment graze on the background of the model building up a store of resources. If within the neighborhood value, they will combine and split their resources 50/50 with the other Deer. Once all the Deer are consumed, the Wolves will run out of food and eventually starve to end the model once their energy runs out.

Known Issues
---------------------
An issue was encountered when importing TKInter module and attempting to add a drop down menu with a model run command to the GUI. This resulted in a runtime error bug when the model would supposedly run:
runfile('C:/Users/Ciara/Documents/GIS_Msc/GEOG_5003/Python/src/unpackaged/abm/Model20.py')
but no GUI would be displayed. I tried re-installing Anaconda libraries, changing the Graphics Backend to and from TKinter and experimenting with Magic commands in the Ipython console, along with restarting the kernal and removing all the variables. The decision was made to omit this part of the model. Aside from this, the model has no other known issues.

Support
---------------------
If you are having issues, please let us know
The creator can be reached by emailing: ----------@gmail.com

Testing
---------------------
A Use Cases section which can be found in the agentbasedmodel source code was added to make the model more user friendly by restricting and guiding the user into inputting adequate values into the console when prompted to determine the global variables. This ensures that the model behaves as expected. A timing function was added to the Stopping Condition so that each time the model finishes, the user is informed in the console how long it ran for.

Ideas for Further Development
-----------------------------
With the addition of more time spent on this model, the creators would have added in a condition to make the Deer close together to herd together as they were beginning to be hunted. Another addition could have been to make the Deer reproduce when they had a large enough store and were close to another Deer with a large store.

License
---------------------
This project is licensed under the ISC license.

---------------------------------------------------------------------
Programming for Geographic Information Analyses - University of Leeds
