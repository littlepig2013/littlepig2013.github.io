//
//  HIN_Graph.h
//

#ifndef __HIN_Graph__
#define __HIN_Graph__

#include <stdio.h>
#include <vector>
#include <map>
#include <string>
#include <set>
#include <iostream>

#include "DataReader.h"


using namespace std;

class HIN_Node
{
public:
    int id_;
    int title_;
    
    string key_;
    
    int type_;
    vector<int> types_id_;
};

class HIN_Edge
{
public:
    int src_;
    int dst_;
    int edge_type_;
    HIN_Edge(int s, int d, int e);
    HIN_Edge();
    bool operator == (const HIN_Edge & e);
};

class HIN_Graph
{
    
public:
    map<int, HIN_Node> nodes_;
    
    map<int, vector<HIN_Edge> > edges_src_;
    map<int, vector<HIN_Edge> > edges_dst_;

    // node type num
    map<int, int> node_type_num_;
    // edge type num
    map<int, int> edge_type_num_;
    // edge type average degree
    map<int, pair<double, double>> edge_type_avg_degree_;
    
    map<string, int> key2id_;
    
    map<string, int> node_types_id_;
    //vector<string> node_types_;
    map<int, string> node_types_;
    
    map<string, int> edge_types_id_;
    vector<string> edge_types_;
    
    
    // sorted index for node_id, X[i][j] means the j element of the i type
    map<int, vector<int> > idOftheSameType_;
    

    
    void buildGraph(map<int,string> node_name, map<int, vector<Edge> > adj, map<int,string> node_type_name, map<int,int> node_type_num, map<int,vector<int> > node_id_to_type, map<int,string> edge_name);
    
};

#endif
