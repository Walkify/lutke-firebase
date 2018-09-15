# Walkify
## ***No** Data, **No** Problem.*
------

This repository is home to the Walkify service codebase. Walkify is a SMS driven service which aims to enable those without reliable data connectivity walking directions and even the ability to hail an Uber. Development is ongoing but an effort will be made to document implementation details here or on the project Wiki.

### **Leveraged Services**
Walkify is developed and hosted primarily through Firebase. Using Firebases Realtime Database we are able to quickly and easily manage our data store, with Firebase Functions we can trigger data layer manipulations reliabaly and efficiently, and using Firebase hosting our website is redily available.

Additionaly we are using Twillio API to trigger our firebase logic on recieving an SMS, Here API is used to translate standard addresses into geo-coordinates, and OSRM is used to generate natural language based directions to the user.

Finally Ubers developer API is used to initiate rides between our users and drivers. Using firbase functions we are able to walk users through a text flow gathering the necessary information to request a ride when walking isnt an option.

### **Design and Implementation process**
The intention with Walkify is to create a seamless experience where a user feels like they have their own assisant helping them home when they need it. We wanted to create a conversation with the objective to provide walking directions from destination A to destination B or if preffered a flow for hailing an uber that felt natural and not mechanical.

To accompish this we have outlined detailed user flows allowing q



