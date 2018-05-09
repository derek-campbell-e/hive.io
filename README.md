# Hive - a better scheduler

## Install instructions
```
    [sudo] npm install hive.io [-g]
```

## Hive Principles
The hive is a delicate ecosystem of bees performing delegated duties. Your one and only `Queen` bee is responsible for locating, spawning, and starting your `Drones`. `Drones` are bees that spawn workers according to your schedule. That schedule can be every 1 minute, or something more complex such as 'every 5 minutes after 10:30 am'. `Workers` do the `Drone`'s bidding. Happily, if you must know. The `Hive` serves as an intelligent endpoint that leverages her `Queen` wherever possible.

### Use your `Mind`
The `Drones` use a modular reference called `Mind` that carries the smart stuff. When to run, what to run, that kind of stuff. We keep them sheltered from the rest of the process for compartmentalization and security. A `Drone:Mind` has no business accessing the `Queen's` or the `Hive's` methods, etc. Keep it simple, and keep them separated. Feel free to store properties, methods, variables in the mind module. Your `Worker` will have access to view/modify the goods, so great if you want a persistent state variable!


### Sample Usage
Let's say you need a complex task done every 5 minutes. Even better if you've already written a module to do it. You can make a `Drone` to do the work for you!
**file: <beeFolder>/drones/complexTaskDrone.js**
```js
    module.exports = function complexTaskDrone(){
        let mind = {}; // our mind property, feel free to add whatever properties you want, just keep the required ones
        
        // the schedule object,
        mind.schedules = {
          hz: 60 * 5, // hz is based on seconds
          // more complex schedules
	        later: {
            house_chores: 'at 5:20 pm on Wednesday',
            room_chores: 'at 6:01 pm on Thursday',
            plan_expenses: 'at 11:30 am on the first day of the month',
          }
        };
        
        mind.maxThreads = 5; // optional, set if you don't want more than # threads / workers operating at once
        
        // * required this is the single task that your drone calls for each time to run based on schedule
        // when commanded via `run drone:complexTaskDrone`, callback contents will be outputted to console
        mind.task = function(callback){
            var externalModule = require('externalModule');
            externalModule.performTask(function(error, result){
                callback(error, result); // MUST call this back when you are finished. If not called back or execution time exceeds max, it will be ended for you
            });
        };
        return mind;
    };
```
Calling `fire complexTaskDrone` will fire your `Drone` immediately displaying in the console the arguments/result from the `callback`.
Otherwise, results will be logged in `./logs/<hiveID>.results.txt`

## Hive
The hive's job is to keep track of things like your bees, your tasks, and also some analytics / metrics. It's got a CLI to handle your commands. It comes built with a socket.io instance so you can listen in on your hive's work. Or communicate with it from far away...

The `Hive` has many jobs, including delegating how bee spawns are handled, remote authentication, API access, networking of other hives, and more. It's got socket access for realtime updates or remote access. 

[Learn more about the Hive](http://www.nope.com)

### CLI Usage
If you're just testing out a hive, perform a global install and then enter `hive new . --enter`

This will create a new hive instance and enter the CLI 
From here you have the following commands at your disposal. *
\* **prepending `hive` to these commands runs them without entering the CLI**

#### Hive Commands
`stats` or `ps` - show current stats like active bees, tasks, stdout/stderr, and metrics

`repl <host>` - replicates current `Drones` from current hive to hive located at `<host>` (requires authentication)

`remote <host>` - enter the remote hive's CLI (require authentication)

`xrem` - exits the remote hive CLI instance

`link <host> [host]` - link a remote hive to this hive, you can blast messages to all connected hives on your network

`unlink [hostOrID] [-a, --all]` - unlink the hive specified by HiveID, LinkID, or unlink all with `-a, --all`

`emit <droneEvent> [args...] [-b, --blast [hiveIDs]]` - emit a message that drones may listen to by <droneEvent> and suppliy the arguments afterwards. You can also blast this message to hives on your network.

`blast <event> [args...] [-s, --self]` - send a message to all hives on your network, with option to also include current hive with `-s, --self`

`reload` - Tell the hive to reload, this reloads the the drones and more

`token` - Generate a token to use for other hives to connect to (bypasses authentication) (this may be removed)

`logs [object]` - shows all logs for current hive instance, with option to filter by object ID or object name

`errors [object]` - shows all errors for the current hive instance, with option to filter by object ID or object name

`results [object]` - shows all results (what the workers return when completing their work) for the current hive instance with option to filter by object ID or object name


#### Drones & Workers
`retire drone <mind>` - retires the specified drone, this unschedules future workers from spawning
`retire drones <minds...>` - retires the specified drones, unscheduling future workers

#### Drone Commands
`spawn drone <mind> [-s, --start] [-f, --fire [schedule]]` - spawn a drone with <mind>, options to start it immediately or fire it immediately. 

`spawn drones [-a, --all] [minds...] [-s, --start]` - spawn drones with <mind>s for running later. Drones do not start until you command them to, or use the `-s, --start` option.

`start drone <mind> [-s, --spawn] [-f, --fire [schedule]]` - start the drone with <mind>, this schedules it's tasks based on what you provide in the mind. Options to spawn the drone if not spawned already and to fire immediately with optional scheduleName.

`start drones [-a, --all] [-f, --fire-now] [drones...] [-s, --spawn]` - start the drones specified or all. Optional argument to fire their task immediately or spawn them if they are not spawned already. 

`fire drone <mind> [-s, --schedule <scheduleName>]` - fire a drone immediately and render the result to the console. Optional arguments to set the schedule otherwise, the schedule name is `fire`

`ls drones` - show the list of drones found / loaded / and running as told by the `Queen`.


#### Worker Commands
`ls workers` - show the list of workers found / loaded / and running as told by the `Queen` and spawned by the `Drones`.

