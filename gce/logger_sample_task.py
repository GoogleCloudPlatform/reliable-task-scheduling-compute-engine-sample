#!/usr/bin/env/ python

# Copyright 2015 Google Inc. All Rights Reserved.

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

    # http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
This is simply an example task, meant to replace an executable bit of code
that does work on your system
"""
import time
import os
import sys

try:
    os.mkdir('/tmp/foo')
except:
    pass

for x in range(20):
    print "Doing work... %s" % x
    try:
        os.mkdir('/tmp/foo/%s' % x)
    except:
        pass
    time.sleep(.5)

sys.exit(0)
