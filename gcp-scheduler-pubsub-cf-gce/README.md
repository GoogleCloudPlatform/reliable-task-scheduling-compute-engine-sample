
# High-Level Description
This solution makes use of the following GCP products: 
- Cloud Scheduler
- Cloud Pub/Sub
- Cloud Functions
- Compute Engine

This solution will start/stop GCE instances based on Labels.  All VMs which have same label can be started/stopped on schedule using Cloud Scheduler.

Using labels offers a lot of flexibility. For example, if you have additional VMs that you would like to start/stop on an existing schedule, then all you need is to apply the same label to them.

You can create different schedules for different labels. You can also use different pub/sub topics for different schedules or labels.

## Tutorial

## Prerequisists 
We suppose that you have a created a  [GCP project](https://cloud.google.com/resource-manager/docs/creating-managing-projects#creating_a_project) and that you have [billing enabled](https://cloud.google.com/billing/docs/how-to/modify-project#enable_billing_for_a_project). 

Make sure the followings APIs activated in your project if they are not yet enabled: 
    1. [Enable the Pub/Sub API](https://console.cloud.google.com/flows/enableapi?apiid=pubsub&redirect=https://console.cloud.google.com)
    2. [Enable the App Engine Admin API](https://console.cloud.google.com/flows/enableapi?apiid=appengine&redirect=https://console.cloud.google.com).  This is required by Cloud Scheduler.
    3. Visit the [Compute Engine instances](https://console.cloud.google.com/compute/instances) page, this will activate the API.
  
  4.Create an App Engine app. This is required by Cloud Scheduler:

           $ gcloud app create --region=us-central
    
   5.Enable the Cloud Scheduler API:
    
           $ gcloud services enable cloudscheduler.googleapis.com

# Tutorial
Let’s say you want to start and stop **development** VMs in zone **europe-west1-b**. Here are the main steps to follow: 
- Set default project 
- Create two Pub/Sub topic called `start_dev_vms` and `stop_dev_vms`.

- Create two cloud functions: 
  - `Name= startInstances`, `Trigger = Pub/Sub` and `Topic=start_dev_vms`.
  - `Name= stopInstances`, `Trigger = Pub/Sub` and `Topic=stop_dev_vms`.
  
- Update the Cloud Functions above by simply copying the code in `start-instances.js` and `stop-instances.js` respectively. Do not forget to replace the content of `package.json` by the one provided here.  

- Create a Cloud Scheduler job called `Start_VMs_job`. In the payload, you will need to specify the **zone** and a  **label** of instances to start as follows `{"zone":"europe-west1-b", "label":"env=dev"}`. Set Cloud Scheduler job's parameters to `Target**=Pub/Sub` and `Topic= start_dev_vms`. 

- Create another Cloud Scheduler job called `Stop_VMs_job`. Set the parameters as following: `payload={"zone":"europe-west1-b", "label":"env=dev"}`, `Target**=Pub/Sub` and `Topic= start_dev_vms`. 

- Once one of the job created above is triggered, Cloud Scheduler will push a message (with a payload containing zone & label) to the corresponding Pub/Sub topic.

- Pub/Sub will then push this message (with its payload) to a Cloud Function the associated Cloud Function.

- The Cloud Function will use the Compute Engine API to query and filter the list of instances using the zone & label specified in the Pub/Sub message. After that, the CF will iterate and start or stop the VMs.


# Important Considerations
- This solution does only switch off VMs, without caring which applications are running inside. You can use shutdown scripts if you wish to perform some tasks before the VM is shutdown.
- Keep in mind the time limits of  cloud functions. 
- If a VM is cloned, labels are also copied with it. This may lead to some undesired side effects, where the cloned VM is also started and stopped on a schedule because they are have the same label.
