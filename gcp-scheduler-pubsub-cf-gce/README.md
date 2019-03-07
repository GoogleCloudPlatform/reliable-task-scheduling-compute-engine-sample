
# High Level Description
This solution makes use of the following GCP products: 
- Cloud Scheduler
- Cloud Pub/Sub
- Cloud Functions
- Compute Engine

This solution will start/stop GCE instances based on Labels.  All VMs which have same label can be started/stopped on schedule using Cloud Scheduler.

# Benefits
Using labels offers a lot of flexibility. For example, if you have additional VMs that you would like to start/stop on an existing schedule, then all you need is to apply the same label to them.

The architecture is Figure 1 is very flexible. You can create different schedules for different labels. You can also use different pub/sub topics for different schedules or labels.

# How to use this (example)
Let’s say you want to start and stop development VMs in zone B as illustrated (in green) in Figure 1. Here are the main steps : 
You will need to create  a cron job “Start_VMs_job” in Cloud Scheduler. In the payload, you will need to specify the “zone” and a  “label” of instances to start.
Once the Start_VMs_job is triggered, it will write a message (with a payload containing zone & label) to a Pub/Sub topic called “start_dev_vms”.
Pub/Sub will then push this message (with its payload) to a Cloud Function called “startVMs()”, which is subscribed to topic ““start_dev_vms”.
The Cloud Function will use the Compute Engine API to query and filter the list of instances using the zone & label specified in the Pub/Sub message. After that, the CF will iterate and start each VM (green line in Figure 1).


# Important Considerations
- This solution does only switch off VMs, without caring which applications are running inside. You can use shutdown scripts if you wish to perform some tasks before the VM is shutdown.
- Keep in mind the time limits of  cloud functions. 
- If a VM is cloned, labels are also copied with it. This may lead to some undesired side effects, where the cloned VM is also started and stopped on a schedule because they are have the same label.
