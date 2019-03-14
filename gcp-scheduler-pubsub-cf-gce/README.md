# Sample: Use Cloud Scheduler and VM labels to start and stop VMs on schedule

This solution makes use of the following GCP products: 
- Cloud Scheduler
- Cloud Pub/Sub
- Cloud Functions
- Compute Engine

This solution will start/stop GCE instances based on **[labels](https://cloud.google.com/compute/docs/labeling-resources)**. All VMs which have the same label (within a specific zone) can be started/stopped on schedule using Cloud Scheduler.

Using labels offers a lot of flexibility. For example, if you have additional VMs that you would like to start/stop on an existing schedule, then all you need is to apply the same label to them.

You can create different schedules for different labels. You can also use different pub/sub topics for different schedules or labels.

# How does it work? (high-level)

- Once your Cloud Scheduler cron is triggered, it will push a message (with a payload containing zone & label) to the corresponding Pub/Sub topic.

- Pub/Sub will then push this message (with its payload) to a Cloud Function.

- The Cloud Function will use the Compute Engine API to query and filter the list of instances using the zone & label specified in the Pub/Sub message. After that, it will iterate and start or stop the VMs one after another.

## Prerequisites 
* This example assumes that you have [created a GCP project](https://cloud.google.com/resource-manager/docs/creating-managing-projects#creating_a_project) and that you have [billing enabled](https://cloud.google.com/billing/docs/how-to/modify-project#enable_billing_for_a_project). 

* Make sure the followings APIs are enabled in your project: 
    1. [Enable the Pub/Sub API](https://console.cloud.google.com/flows/enableapi?apiid=pubsub&redirect=https://console.cloud.google.com)
    2. [Enable the Cloud Functions API](https://console.cloud.google.com/flows/enableapi?apiid=cloudfunctions&redirect=https://console.cloud.google.com)
    3. [Enable the App Engine Admin API](https://console.cloud.google.com/flows/enableapi?apiid=appengine&redirect=https://console.cloud.google.com).  This is required by Cloud Scheduler.
    4. Visit the [Compute Engine instances](https://console.cloud.google.com/compute/instances) page, this will activate the API.
    5. Create an App Engine app (if you do not already have one in place). This is required by Cloud Scheduler:

           $ gcloud app create --region=us-central1
    6. Enable the Cloud Scheduler API:
    
           $ gcloud services enable cloudscheduler.googleapis.com

Ensure that the following tools are installed:

* Install [`git`](https://git-scm.com/downloads).

* Install [Python 2.7](https://www.python.org/download/releases/2.7/).

* Install [Python `pip`](https://pip.pypa.io/en/latest/installing.html).

* [Download and install the Google Cloud SDK](http://cloud.google.com/sdk/).


**Important**: This tutorial uses several billable components of Google Cloud Platform. Make sure to delete the resources once you have finished this tutorial.
           
## Tutorial
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

1. Create a Pub/Sub topic `start_dev_vms` that messages will get pushed to in order to start VMs.

        $ gcloud pubsub topics create start_dev_vms
        
2. Create a Pub/Sub topic `stop_dev_vms` that messages will get pushed to in order to stop VMS.

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
3. Check that the two jobs above are created by running this command:

     ``` 
      gcloud beta scheduler jobs list`
      
      ```

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
3. Create a first cloud function **start-instances-fct**  which will start instances once it is triggered.
    - Change directory to the folder containing the source code of the function:
    
        ```
            cd start-instances-fct/
        ```
    - Create the Cloud Function using the command below :

        ```
            gcloud functions deploy start-instances-fct --region=us-central1 --entry-point=startInstances \
                --runtime=nodejs8 --trigger-topic=start_dev_vms
        ```
    
4. Create another cloud function **stop-instances-fct**  which will stop instances once it is triggered : 
    - Change directory to the folder conraining the source code of the function:
    
        ```
            cd stop-instances-fct/
        ```
    - Create the Cloud Function as following:

        ```
            gcloud functions deploy stop-instances-fct --region=us-central1 --entry-point=stopInstances \
                --runtime=nodejs8 --trigger-topic=stop_dev_vms
        ```
### Testing 

1.  Now that you have created all needed resources it is time for testing. You can do this from the Google Cloud Console or by using gcloud commands. In the UI, navigate to "Cloud Scheduler", identify your **Start_VMs_job** cron job and click on "Run now". This will start the two VMs created earlier. Alternatively, you can simply run the following comand: 

     
            gcloud beta scheduler jobs run Start_VMs_job
      

2.  Navigate to "Compute Engine" section in the UI and check if the VMs have been started. Or simply run the following command and check the status of your instances (allow few seconds delay). 
     
            gcloud compute instances list
     
3.  Navigate back to Cloud Scheduler, find your cron job **Start_VMs_job** and click on "Run now". Or simply run the following command: 

      
            gcloud beta scheduler jobs run Stop_VMs_job
      

4.  Navigate Back "Compute Engine" section in the UI and check if the VMs are stopped (allow few seconds delay). Or simply run the following command and check the status of your instances. 
       
            gcloud compute instances list
    

### Clean Up

In order to avoid unexpected costs, you need to **delete** all GCP resources created in this tutorial.


# Important Considerations
- This solution switches off VMs, not the applications running on them. You can use [shutdown scripts](https://cloud.google.com/compute/docs/shutdownscript) if you wish to perform some tasks before the VM is shutdown.
- Keep in mind the time limits of  cloud functions. 
- If a VM is cloned, labels are also copied with it. This may lead to some undesired side effects, where the cloned VM is also started and stopped on a schedule because they have the same label.
