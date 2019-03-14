
# High-Level Description
This solution makes use of the following GCP products: 
- Cloud Scheduler
- Cloud Pub/Sub
- Cloud Functions
- Compute Engine

This solution will start/stop GCE instances based on **Labels**. All VMs which have same label (within a specific zone) can be started/stopped on schedule using Cloud Scheduler.

Using labels offers a lot of flexibility. For example, if you have additional VMs that you would like to start/stop on an existing schedule, then all you need is to apply the same label to them.

You can create different schedules for different labels. You can also use different pub/sub topics for different schedules or labels.

# How does it work ? (high-level)

- Once one of the job created above is triggered, Cloud Scheduler will push a message (with a payload containing zone & label) to the corresponding Pub/Sub topic.

- Pub/Sub will then push this message (with its payload) to a Cloud Function the associated Cloud Function.

- The Cloud Function will use the Compute Engine API to query and filter the list of instances using the zone & label specified in the Pub/Sub message. After that, the CF will iterate and start or stop the VMs.

## Tutorial

## Prerequisits 
* We suppose that you have a created a  [GCP project](https://cloud.google.com/resource-manager/docs/creating-managing-projects#creating_a_project) and that you have [billing enabled](https://cloud.google.com/billing/docs/how-to/modify-project#enable_billing_for_a_project). 

* Make sure the followings APIs activated in your project if they are not yet enabled: 
    1. [Enable the Pub/Sub API](https://console.cloud.google.com/flows/enableapi?apiid=pubsub&redirect=https://console.cloud.google.com)
    2. [Enable the Cloud Functions API](https://console.cloud.google.com/flows/enableapi?apiid=cloudfunctions&redirect=https://console.cloud.google.com)
    3. [Enable the App Engine Admin API](https://console.cloud.google.com/flows/enableapi?apiid=appengine&redirect=https://console.cloud.google.com).  This is required by Cloud Scheduler.
    4. Visit the [Compute Engine instances](https://console.cloud.google.com/compute/instances) page, this will activate the API.
    5. Create an App Engine app. This is required by Cloud Scheduler:

           $ gcloud app create --region=us-central1
    6. Enable the Cloud Scheduler API:
    
           $ gcloud services enable cloudscheduler.googleapis.com

Ensure that the following is installed if not already on your system:

* Install [`git`](https://git-scm.com/downloads).

* Install [Python 2.7](https://www.python.org/download/releases/2.7/).

* Install [Python `pip`](https://pip.pypa.io/en/latest/installing.html).

* [Download and install the Google Cloud SDK](http://cloud.google.com/sdk/).


**Important**: This tutorial uses several billable components of Google Cloud Platform. Make sure to delete the resources once you have finished this tutorial.
           
## Step by Step
Let’s say you want to start and stop **development** VMs in zone **us-central1-c**. Below are the main steps to follow. 
### Create two Compute Engine instances

1. Configure the `gcloud` command-line tool to use your project as a default.

        $ gcloud config set project <your-project-id>

    Where you replace `<your-project-id>`  with the identifier of your cloud
    project.

2. Create two `f1-micro` Compute Engine instances (`my-instance1` and `my-instance2`), with the label `env:dev`:

        $ gcloud compute instances create my-instance1 --zone=us-central1-c --machine-type=f1-micro --labels=env=dev
        $ gcloud compute instances create my-instance2 --zone=us-central1-c --machine-type=f1-micro --labels=env=dev

3. Check that your instances are up and running by using `gcloud compute instances list`.

### Create two Pub/Sub topics

1. Create a Pub/Sub topic `start_dev_vms` that messages will get pushed to in orde to start VMs.

        $ gcloud pubsub topics create start_dev_vms
        
2. Create a Pub/Sub topics `stop_dev_vms`that messages will get pushed to in order to stops VMS.

        $ gcloud pubsub topics create stop_dev_vms

3. Check that the topics are created by using this command `gcloud pubsub topics list`.

### Create two Cloud Scheduler jobs

1. Create a Cloud Scheduler job called `Start_VMs_job`. Once triggered, this job will push a message with payload `payload={"zone":"us-central1-c", "label":"env=dev"}` in order to start VMs with label `env:dev`, every workday at 9:00 o'clock (UTC).

     ``` 
      gcloud beta scheduler jobs create pubsub Start_VMs_job --schedule="0 9 * * 1-5" \
              --topic=start_dev_vms --message-body='{"zone":"us-central1-c", "label":"env=dev"}' 
      ```
        
2. Create a Cloud Scheduler job called `Stop_VMs_job`. Once triggered, this job will push a message with payload `payload={"zone":"us-central1-c", "label":"env=dev"}` in order to stop VMs with label `env:dev`, every workday at 9:30 o'clock (UTC).
     
     ``` 
      gcloud beta scheduler jobs create pubsub Stop_VMs_job --schedule="30 9 * * 1-5" \
              --topic=stop_dev_vms --message-body='{"zone":"us-central1-c", "label":"env=dev"}' 
      ```
3. Check that the two jobs above have been created `gcloud beta scheduler jobs list`.

**Note**: the `schedule` is specified in [unix-cron format](https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules). Moreover, you can choose another time zone by making use of the attribute `time-zone`, see [here](https://cloud.google.com/sdk/gcloud/reference/alpha/scheduler/jobs/create/pubsub) for more information.

### Create two Cloud Functions

1. Download this repository to your local machine or into your [Cloud Shell console](https://cloud.google.com/shell/) by running this command:

    ``` 
    $ git clone https://github.com/GoogleCloudPlatform/reliable-task-scheduling-compute-engine-sample
    ``` 

2. Change directories to the `reliable-task-scheduling-compute-engine-sample/gcp-scheduler-pubsub-cf-gce` directory. The exact path
depends on where you placed the directory when you cloned the sample files from
GitHub.

    ```
    $ cd reliable-task-scheduling-compute-engine-sample/gcp-scheduler-pubsub-cf-gce
    ``` 
3. ** Create a first cloud function `start-instances-fct` which will start instances once it is triggered.
    - Change directory 
    
        ```
            cd start-instances-fct/
        ```
    - Create the Cloud Function as following:

        ```
            gcloud functions deploy start-instances-fct --region=us-central1 --entry-point=startInstances \
                --runtime=nodejs8 --trigger-topic=start_dev_vms
        ```
    
4. Create a second cloud function `stop-instances-fct ` which will stop instances once it is triggered : 
    - Change directory 
    
        ```
            cd stop-instances-fct/
        ```
    - Create the Cloud Function as following:

    ```
        gcloud functions deploy stop-instances-fct --region=us-central1 --entry-point=stopInstances \
            --runtime=nodejs8 --trigger-topic=stop_dev_vms
    ```

# Important Considerations
- This solution does only switch off VMs, without caring which applications are running inside. You can use shutdown scripts if you wish to perform some tasks before the VM is shutdown.
- Keep in mind the time limits of  cloud functions. 
- If a VM is cloned, labels are also copied with it. This may lead to some undesired side effects, where the cloned VM is also started and stopped on a schedule because they are have the same label.
