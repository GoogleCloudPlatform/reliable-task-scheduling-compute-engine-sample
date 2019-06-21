# Sample: Reliable Task Scheduling on Google Compute Engine with Cloud Scheduler

In distributed systems, such as a network of Google Compute Engine
instances, it is challenging to reliably schedule tasks because any individual
instance may become unavailable due to autoscaling or network partitioning.

Google Cloud Platform provides a managed [Cloud Scheduler](https://cloud.google.com/scheduler/)
service. Using this service for scheduling and Google Cloud Pub/Sub for
distributed messaging, you can build an application to reliably schedule tasks
across a fleet of Compute Engine instances.

This sample illustrates how to build a solution. For a full description of
the design pattern used in this sample, see
[Reliable Task Scheduling on Compute Engine with Cloud Scheduler](http://cloud.google.com/solutions/reliable-task-scheduling-compute-engine).

For an example of how to start and stop VMs, see [Scheduling Compute Instances with Cloud Scheduler](https://cloud.google.com/scheduler/docs/start-and-stop-compute-engine-instances-on-a-schedule).

## About the sample

This sample contains two components:

* Instructions for configuring Cloud Scheduler to send cron messages to Cloud Pub/Sub topics.

* A utility that runs on Compute Engine. This utility monitors a Cloud Pub/Sub
    topic. When it detects a new message, it runs the corresponding command
    locally on the server.

You specify the cron messages to send and their timing in the Cloud Scheduler
configuration.  When Cloud Scheduler fires a scheduled event, the cron message is
passed to the corresponding previously created Cloud Pub/Sub topic.

The utility running on the Compute Engine instances receives cron messages from
Cloud Pub/Sub and runs the specified commands that are normally run by cron. To
do so, it performs the following actions:

* Creates subscriptions to Cloud Pub/Sub topics.
* Monitors those subscriptions for new messages using a long-polling loop.
* In response to messages, it runs the corresponding command in a subprocess,
    during which it:
    * Maintains the lease on the Cloud Pub/Sub message and extends the lease
        time on a Cloud Pub/Sub message as needed for long-running commands.
    * Acknowledges and releases the message on exit of the command. The exit
        code is not required to be successful; additional retry logic is left
        as an exercise.


This sample includes the reusable wrapper code of the utility, an example of its
use, and a sample script that it runs.

## How to run the sample

The overview for configuring and running this sample is as follows:

1. Create a project and other cloud resources.
2. Clone or download the sample code.
3. Create the Cloud Pub/Sub topic.
4. Create the Cloud Scheduler job.
5. Run a utility on Compute Engine that monitors the Cloud Pub/Sub topic for
    messages. and, on detecting one, runs a sample script locally on the
    instance.
6. Verify the script ran on schedule by checking the Cloud Logging output.

### Prerequisites

* If you don’t already have one, create a
    [Google Account](https://accounts.google.com/SignUp).

* Create a Developers Console project.
    1. In the [Google Developers Console](https://console.developers.google.com/project), select
      **Create Project**.
    2. [Enable the Pub/Sub API](https://console.cloud.google.com/flows/enableapi?apiid=pubsub&redirect=https://console.cloud.google.com)
    3. [Enable the App Engine Admin API](https://console.cloud.google.com/flows/enableapi?apiid=appengine&redirect=https://console.cloud.google.com).  This is required by Cloud Scheduler.
    4. Visit the [Compute Engine instances](https://console.cloud.google.com/compute/instances) page, this will activate the API.
    5. [Enable Project Billing](https://support.google.com/cloud/answer/6293499#enable-billing)
    6. Create an App Engine app. This is required by Cloud Scheduler:

           $ gcloud app create --region=us-central
    
    7. Enable the Cloud Scheduler API:
    
           $ gcloud services enable cloudscheduler.googleapis.com

Ensure that the following is installed if not already on your system:

* Install [`git`](https://git-scm.com/downloads).

* Install [Python 2.7](https://www.python.org/download/releases/2.7/).

* Install [Python `pip`](https://pip.pypa.io/en/latest/installing.html).

* [Download and install the Google Cloud SDK](http://cloud.google.com/sdk/).


Important: This tutorial uses several billable components of Google Cloud
Platform. To estimate the cost of running this sample:

* Assume the utility runs on a single `f1-micro` Google Compute Instance for
  15 minutes of one day while you test the sample. After which, you delete
  the project, releasing all resources.  That's **0.25 hours per month**.
* Cloud Scheduler is free for up to **3 jobs per month**.

Use the [Google Cloud Platform Pricing Calculator](https://cloud.google.com/products/calculator/#id=beb5326f-90c3-4842-9c3f-a3761b40fbe3)
to generate a cost estimate based on this projected usage. New Cloud Platform
users may be eligible for a [free trial](http://cloud.google.com/free-trial).

### Clone the sample code

To clone the GitHub repository to your computer, run the following command:

    $ git clone https://github.com/GoogleCloudPlatform/reliable-task-scheduling-compute-engine-sample

Change directories to the `reliable-task-scheduling-compute-engine-sample` directory. The exact path
depends on where you placed the directory when you cloned the sample files from
GitHub.

    $ cd reliable-task-scheduling-compute-engine-sample

### Create Pub/Sub topic

1. Configure the `gcloud` command-line tool to use the project you created in
    Prerequisites.

        $ gcloud config set project <your-project-id>

    Where you replace `<your-project-id>`  with the identifier of your cloud
    project.

1.  Create the Pub/Sub topic that you will push messages to.

        $ gcloud pubsub topics create test

The topic is now listed under `gcloud pubsub topics list`.  You can also see the topic
in the console:

Big Data > Pub/Sub

### Create Cloud Scheduler job

> **Note**: At time of writing Cloud Scheduler is in Beta.  The keyword `beta` in the commands below
will no longer be necessary after Cloud Scheduler becomes generally available.

Next, we configure Cloud Scheduler to push a message containing the string `test job` every
minute to the Pub/Sub topic `test` that we just created.

    gcloud scheduler jobs create pubsub test-job --schedule="* * * * *" \
      --topic=test --message-body="test job"

The `schedule` is specified in [unix-cron format](https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules).
A `*` in every field means the job runs every minute, every hour, every day of the month,
every month, every day of the week.  More simply put, it runs once per minute.

The job is now visible in `gcloud beta scheduler jobs list`.  You can also see the jobs 
in the console:

Tools > Cloud Scheduler 

Execution logs for the job are visible via the Logs link for each job.

### How Cloud Pub/Sub subscriptions are specified

The utility running on a Compute Engine instance monitors a set of Cloud Pub/Sub
topic subscriptions and runs commands on that instance each time it receives a message.
By configuring which topics the utility monitors, you can control the jobs that
run on each instance. Separating the scheduling logic from the utility logic
using Cloud Pub/Sub messaging gives you the ability to schedule all of your
jobs with Cloud Scheduler, and then configure the utility on each instance to
listen to only the job messages that apply to that instance.

In the sample implementation of the utility, the topic to subscribe to is set as
a variable in `test_executor.py`.

    TOPIC = 'test'

This value is used when the code creates an `Executor` object to monitor a Cloud Pub/Sub
topic.

    test_executor = Executor(topic=TOPIC, project=PROJECT, task_cmd=logger, subname='logger_sample_task')

If you only need the utility to monitor a single topic, you can simply change
the value of `TOPIC` in this script. To have the utility monitor multiple topics,
you need to instantiate multiple `Executor` objects.

For this runthrough of the sample, leave `TOPIC` set to `'test'` so you can
verify your results as described in the following sections.


### Specify the commands to run on the instance

In this sample, the utility acts as a wrapper to run commands that can be
configured as cron jobs. These commands are specified in the `test_executor.py`
file. For this example, the command runs a script `logger_sample_task.py` that simply
prints output to `stdout`.

    script_path = os.path.abspath(os.path.join(os.getcwd(), 'logger_sample_task.py'))
    sample_task = "python -u %s" % script_path

To modify the sample to run your own tasks, update the command syntax in the
`sample_task` variable.

For your first time running the sample, leave this set to the `logger_sample_task`
script so you can verify your results as described in the following sections.


### Install the utility script on a Compute Engine instance

The utility script runs on your Compute Engine instances and subscribes to the
Cloud Pub/Sub topics you specified in Cloud Scheduler. When the utility script
receives a message, it runs the corresponding job locally. To make this
possible, install the utility script on each instance where
you want durable cron jobs to run. The script files are in the `gce`
directory.


1. Create a Compute Engine instance with Cloud Pub/Sub scope. In the following
    example, the instance name is `cronworker`.

        $  gcloud compute instances create cronworker \
          --machine-type f1-micro \
          --scopes https://www.googleapis.com/auth/pubsub,https://www.googleapis.com/auth/logging.write \
          --zone us-central1-a


2. Edit `gce/test_executor.py` to change the project constant:

        PROJECT = 'your-project-id'

    Replace `your-project-id` with the identifier of your cloud project.

4. Copy the utility script files to the new instance.

        $  gcloud compute scp --recurse gce cronworker:~/ --zone=us-central1-a


5. SSH into the Compute Engine instance. The following steps are run on the instance over the SSH session.

        $  gcloud compute ssh cronworker \
          --zone us-central1-a


6. Update the apt-get package lists on the instance.

        $ sudo apt-get update


7. Install `pip` and the Python development libraries on the instance.

        $ sudo apt-get install -y python-pip python-dev


8. Install the [Python client library for accessing Google APIs](https://github.com/google/google-api-python-client) on the instance with Python Pip.

        $ sudo pip install --upgrade google-api-python-client oauth2client pytz


9. Change directories on the instance to the directory where you uploaded the utility script files.

        $ cd gce


10. Run the utility file script, `test_executor.py`

        $ python test_executor.py



### Verify cron jobs run on the instance

After you start the utility, it checks for messages on the specified Cloud
Pub/Sub topic (`'test'`, by default). When it checks the subscription and receives
a message, it runs a sample task that simply prints output to `stdout`. If you are
still connected to the instance using SSH, you’ll see output like the following
when the task runs.

    Doing work... 1
    Doing work... 2
    Doing work... 3
    …
    Doing work... 20

The utility script records its activity using Google Cloud Logging. After a cron
job has had time to run, you can view the `stdout` output of the job in the Logs
Viewer for Google Compute Engine.

1. Open the [Developers Console](https://console.developers.google.com) and select your project from the
    list.

2. From the navigational menu, select **Stackdriver > Logging > Logs**.

3. Expand the dropdown box displaying **GAE Application** and select
    **GCE VM Instance > cronworker**.

4. Expand the dropdown box displaying **All Logs**, and select
    **task_runner** to display the logged messages from the executor utility,
    and **test_sample_task_task** to display the output of the sample task running
    on the Compute Engine instance. Click **Ok** to confirm.

You can also see the topic in the Pub/Sub console now lists the subscription.

### Clean up

Now that you have tested the sample, delete the cloud resources you created to
prevent further billing for them on your account.

* Delete the Compute Engine instance.

        $ gcloud compute instances delete cronworker --zone=us-central1-a


* Delete the Cloud Scheduler job.

    You can delete the job from the Cloud Scheduler section of the
    [Developers Console](https://console.developers.google.com).

* Delete the Cloud Pub/Sub topic.
    You can delete the topic and associated subscriptions from the Cloud Pub/Sub
    section of the [Developers Console](https://console.developers.google.com).


## License

Copyright 2019 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
