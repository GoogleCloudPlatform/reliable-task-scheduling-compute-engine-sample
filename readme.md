# Sample: Reliable Task Scheduling on Google Compute Engine
In distributed systems, such as a network of Google Compute Engine
instances, it is challenging to reliably schedule tasks because any individual
instance may become unavailable due to autoscaling or network partitioning.

Google AppEngine provides a Cron service. Using this service for scheduling and
Google Cloud Pub/Sub for distributed messaging, you can build an application to
reliably schedule tasks across a fleet of Compute Engine instances.

This sample illustrates how to build a solution. For a full description of
the design pattern used in this sample, see
[Reliably Schedule Tasks on Google Compute Engine](http://cloud.google.com/solutions/reliable-task-scheduling-compute-engine).

## About the sample

This sample contains two components:

* An App Engine application, that uses App Engine Cron Service
    to relay cron messages to Cloud Pub/Sub topics.

* A utility that runs on Compute Engine. This utility monitors a Cloud Pub/Sub
    topic. When it detects a new message, it runs the corresponding command
    locally on the server.

You specify the cron messages to send in the `cron.yaml` file of the App Engine
application. This file is written in
[YAML format](http://cloud.google.com/appengine/docs/python/config/cron#Python_app_yaml_About_cron_yaml).
The App Engine application uses the final path component of the event-handler
URL as the name of the corresponding Cloud Pub/Sub topic. For example, if an
event handler is specified as `url: /events/test`, the Cloud Pub/Sub topic name
is `test`.

When the Cron Service fires a scheduled event, the App Engine
application handles the request and passes the cron message to the corresponding
Cloud Pub/Sub topic. If the specified Cloud Pub/Sub topic does not exist,
the App Engine application creates it.

The utility running on the Compute Engine instances receives cron messages from
Cloud Pub/Sub and runs the specified commands that are normally run by cron. To
do so, it performs the following actions:

* Creates subscriptions to Cloud Pub/Sub topics.
* Monitors those subscriptions for new messages using a long-polling loop.
* In response to messages, it runs the corresponding command in a subprocess,
    during which it:
    * Maintains the the lease on the Cloud Pub/Sub message and extends the lease
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
3. Specify cron jobs in a YAML file.
4. Deploy the App Engine application.
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
    3. Visit the [Compute Engine instances](https://console.cloud.google.com/compute/instances) page, this will activate the API.
    4. [Enable Project Billing](https://support.google.com/cloud/answer/6293499#enable-billing)

Ensure that the following is installed if not already on your system:

* Install [`git`](https://git-scm.com/downloads).

* Install [Python 2.7](https://www.python.org/download/releases/2.7/).

* Install [Python `pip`](https://pip.pypa.io/en/latest/installing.html).

* [Download and install the Google Cloud SDK](http://cloud.google.com/sdk/).


Important: This tutorial uses several billable components of Google Cloud
Platform. To estimate the cost of running this sample:
<ul>
  <li>Assume the utility runs on a single `f1-micro` Google Compute Instance for
      15 minutes of one day while you test the sample. After which, you delete
      the project, releasing all resources.
      That's <b>0.25 hours per month</b>.</li>
  <li>For Google App Engine costs, assume that the App Engine application
      runs on a single instance for 15 minutes. This results in 1 instance hour,
      or a rate of <b>.00014 instances per hour</b> averaged over a month.</li>
</ul>
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

### Specify cron jobs

App Engine Cron Service job descriptions are specified in `gae/cron.yaml`, a file in
the App Engine application. You define tasks for App Engine Task Scheduler
in [YAML format](http://yaml.org/). The following example
shows the syntax.

    cron:
      - description: <description of the job>
               url: /events/<topic name to publish to>
               schedule: <frequency in human-readable format>

For a complete description of how to use YAML to specify jobs for Cron Service,
including the schedule format, see
[Scheduled Tasks with Cron for Python](https://cloud.google.com/appengine/docs/python/config/cron#Python_app_yaml_The_schedule_format).

Leave the default cron.yaml as is for now to run through the sample.

### Upload the application to App Engine

In order for the App Engine application to schedule and relay your events,
you must upload it to a Developers Console project. This is the project
that you created in **Prerequisites**.

1. Configure the `gcloud` command-line tool to use the project you created in
    Prerequisites.

        $ gcloud config set project <your-project-id>

    Where you replace `<your-project-id>`  with the identifier of your cloud
    project.

1. Include the Python API client in your App Engine application.

        $ pip install -t gae/lib/ google-api-python-client

    Note: if you get an error and used Homebrew to install Python on OS X,
    see [this fix](https://github.com/Homebrew/homebrew/blob/master/share/doc/homebrew/Homebrew-and-Python.md#note-on-pip-install---user).

1. Create an App Engine App

		$ gcloud beta app create

1. Deploy the application to App Engine.

        $ gcloud app deploy --version=1 gae/app.yaml \
          gae/cron.yaml

After you deploy the App Engine application it uses the App Engine Cron Service
to schedule sending messages to Cloud Pub/Sub. If a Cloud Pub/Sub topic
specified in `yaml.cron` does not exist, the application creates it.

You can see the cron jobs under in the console under:

Compute > App Engine > Task queues > Cron Jobs

You can also see the auto-created topic (after about a minute) in the console:

Big Data > Pub/Sub

### How Cloud Pub/Sub subscriptions are specified

The utility running on a Compute Engine instance monitors a set of Cloud Pub/Sub
topic subscriptions and runs commands on that instance each time it receives a message.
By configuring which topics the utility monitors, you can control the tasks that
run on each instance. Separating the scheduling logic from the utility logic
using Cloud Pub/Sub messaging gives you the ability to schedule all of your
tasks with ``, and then configure the utility on each instance to
listen to only the task messages that apply to that instance.

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
Cloud Pub/Sub topics you specified in `cron.yaml`. When the utility script
receives a message, it runs the corresponding task locally. To make this
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

        $  gcloud compute copy-files gce `whoami`@cronworker: \
          --zone us-central1-a


5. SSH into the Compute Engine instance. The following steps are run on the instance over the SSH session.

        $  gcloud compute ssh cronworker \
          --zone us-central1-a


6. Update the apt-get package lists on the instance.

        $ sudo apt-get update


7. Install `pip` and the Python development libraries on the instance.

        $ sudo apt-get install -y python-pip python-dev


8. Install the [Python client library for accessing Google APIs](https://github.com/google/google-api-python-client) on the instance with Python Pip.

        $ sudo pip install --upgrade google-api-python-client pytz


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

2. From the navigational menu, select **Monitoring > Logs**.

3. Expand the dropdown box displaying **App Engine** and select
    **Compute Engine**.

4. Expand the dropdown box displaying **All Logs**, and select
    **task_runner** to display the logged messages from the executor utility,
    and **test_sample_task_task** to display the output of the sample task running
    on the Compute Engine instance.

You can also see the topic in the Pub/Sub console now lists the subscription.

### Clean up

Now that you have tested the sample, delete the cloud resources you created to
prevent further billing for them on your account.

* Delete the Compute Engine instance.

        $ gcloud compute instances delete cronworker --zone=us-central1-a


* Disable and delete the App Engine application as described in
    [Disable or delete your application](http://cloud.google.com/appengine/docs/adminconsole/applicationsettings#disable_or_delete_your_application)
    in the Google App Engine documentation.


* Delete the Cloud Pub/Sub topic.
    You can delete the topic and associated subscriptions from the Cloud Pub/Sub
    section of the [Developers Console](https://console.developers.google.com).


##License:

Copyright 2015 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
